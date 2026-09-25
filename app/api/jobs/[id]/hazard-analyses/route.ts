import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api';
import { parseJsonBody, requiredString, optionalString, requiredDate, NotFoundError, ValidationError } from '@/lib/validate';

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
  try {
    const prisma = getDb();
    const job = await prisma.job.findUnique({ where: { id: params.id } });
    if (!job) {
      throw new NotFoundError('No job matches that id.');
    }

    const body = await parseJsonBody(request);
    const taskDescription = requiredString(body, 'taskDescription', 'Describe the task.');
    const hazardsIdentified = requiredString(body, 'hazardsIdentified', 'List the hazards identified.');
    const controlMeasures = requiredString(body, 'controlMeasures', 'List the control measures.');
    const reviewDate = requiredDate(body, 'reviewDate', 'Enter a valid review date.');
    const preparedByWorkerId = optionalString(body, 'preparedByWorkerId');
    if (preparedByWorkerId) {
      const worker = await prisma.worker.findUnique({ where: { id: preparedByWorkerId } });
      if (!worker) {
        throw new ValidationError('No worker matches the prepared-by id.');
      }
    }

    const jha = await prisma.jobHazardAnalysis.create({
      data: {
        jobId: job.id,
        taskDescription,
        hazardsIdentified,
        controlMeasures,
        reviewDate,
        preparedByWorkerId,
      },
    });

    return NextResponse.json({ id: jha.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
