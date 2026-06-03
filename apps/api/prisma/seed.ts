import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.create({
    data: { name: 'Default Project', description: 'Initial project' },
  });

  const env = await prisma.environment.create({
    data: {
      name: 'Development',
      sdkKey: 'sdk-dev-001',
      projectId: project.id,
    },
  });

  await prisma.flag.create({
    data: {
      key: 'new-dashboard',
      name: 'New Dashboard',
      description: 'Toggle the redesigned dashboard',
      type: 'BOOLEAN',
      enabled: true,
      environmentId: env.id,
      rolloutPercentage: 100,
    },
  });

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
