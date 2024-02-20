import { Gitlab } from '@gitbeaker/rest';
import 'dotenv/config';
import fs from 'fs';

console.log('Gitlab:', process.env.GITLAB);
console.log('Token:', process.env.TOKEN);

const api = new Gitlab({
  host: process.env.GITLAB,
  token: process.env.TOKEN,
  rateLimits: {
    core: 100,
    search: 100,
  },
});

const projects = [84, 83, 157, 256, 96, 231, 170, 11, 27, 230, 19, 227];

// const projects = [36]; //BSHOP

const data = [];
const data_with_labels = [];

async function main() {
  for (const projectId of projects) {
    const project = await api.Projects.show(projectId);
    console.log(`Project: ${project.name} - ${project.id}`);
    const issues = await api.Issues.all({ projectId: projectId, state: 'opened' });
    if (issues.length > 0) {
      await Promise.all(
        issues
          .filter((issue) => issue.assignees.length > 0)
          .map(async (issue) => {
            data.push({
              id: issue.id,
              iid: issue.iid,
              title: issue.title,
              assignees: issue.assignees.map((assignee) => {
                return { id: assignee.id, name: assignee.name };
              }),
              created_at: issue.created_at,
              updated_at: issue.updated_at,
              closed_at: issue.closed_at,
              dueDate: issue.dueDate,
              estimateTime: issue.time_stats.time_estimate,
              totalTimeSpent: issue.time_stats.total_time_spent,
              projectId: issue.project_id,
              projectName: project.name,
            });
          }),
      );
    }
  }

  await Promise.all(
    data.map(async (issue) => {
      await api.IssueLabelEvents.all(issue.projectId, issue.iid).then((labels) => {
        const labels_events = labels
          .filter((label) => label.label && label.label.name.startsWith('Status::'))
          .map((label) => {
            return {
              id: label.id,
              name: label.label.name,
              created_at: label.created_at,
              ...(label.user ? { user: { id: label.user.id, name: label.user.name } } : { user: {} }),
              action: label.action,
            };
          });
        data_with_labels.push({
          ...issue,
          labels_events,
        });
      });
    }),
  );

  fs.writeFileSync('issues.json', JSON.stringify(data_with_labels, null, 2));
  console.log('Issues saved in issues.json');
  process.exit(0);
}

main();
