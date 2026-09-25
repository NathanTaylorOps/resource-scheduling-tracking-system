/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Inlined into both the server and client bundles at build time, so a
    // date renders in the same timezone on both sides and never hydrates
    // differently. See lib/domain/dates.ts for what this governs.
    APP_TIMEZONE: process.env.APP_TIMEZONE ?? 'America/Los_Angeles',
  },
};

module.exports = nextConfig;
