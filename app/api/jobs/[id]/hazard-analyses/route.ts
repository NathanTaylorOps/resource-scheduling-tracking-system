import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface CreateJhaBody {
  taskDescription: string;
  hazardsIdentified: string;
  controlMeasures: string;
  reviewDate: string;
  preparedByWorkerId?: string;
}

/**
 * Records a job hazard analysis for one task on a job — the per-task
 * "what could go wrong here, and what stops it" writeup a toolbox talk
 * (see ToolboxTalk) doesn't capture on its own, since a toolbox talk is a
 * meeting record, not a hazard-by-hazard breakdown for a specific task. No
 * status field: unlike a permit or incident, a JHA doesn't move through a
 * lifecycle here — it's filed once for a task and superseded by filing a
 * new one if the task or its hazards change, so there's nothing to audit a
 * transition on.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const prisma = getDb();
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) {
    return NextResponse.json({ error: 'No job matches that id.' }, { status: 404 });
  }

  let body: CreateJhaBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const taskDescription = body.taskDescription?.trim();
  const hazardsIdentified = body.hazardsIdentified?.trim();
  const controlMeasures = body.controlMeasures?.trim();
  if (!taskDescription) {
    return NextResponse.json({ error: 'Describe the task.' }, { status: 400 });
  }
  if (!hazardsIdentified) {
    return NextResponse.json({ error: 'List the hazards identified.' }, { status: 400 });
  }
  if (!controlMeasures) {
    return NextResponse.json({ error: 'List the control measures.' }, { status: 400 });
  }
  const reviewDate = new Date(body.reviewDate);
  if (Number.isNaN(reviewDate.getTime())) {
    return NextResponse.json({ error: 'Enter a valid review date.' }, { status: 400 });
  }
  if (body.preparedByWorkerId) {
    const worker = await prisma.worker.findUnique({ where: { id: body.preparedByWorkerId } });
    if (!worker) {
      return NextResponse.json({ error: 'No worker matches the prepared-by id.' }, { status: 400 });
    }
  }

  const jha = await prisma.jobHazardAnalysis.create({
    data: {
      jobId: job.id,
      taskDescription,
      hazardsIdentified,
      controlMeasures,
      reviewDate,
      preparedByWorkerId: body.preparedByWorkerId || null,
    },
  });

  return NextResponse.json({ id: jha.id }, { status: 201 });
}
