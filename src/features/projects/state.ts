/** Projects in memory and the one open in the Projects view. */
import { signal } from '@preact/signals';
import { api } from '../../api/commands';
import type { Project } from '../../api/types';

export const projects = signal<Project[]>([]);
export const projectsLoaded = signal(false);
export const selectedProject = signal<number | null>(null);

export async function loadProjects(): Promise<Project[]> {
  const list = await api.listProjects();
  projects.value = list;
  projectsLoaded.value = true;
  if (selectedProject.value === null || !list.some((p) => p.id === selectedProject.value)) selectedProject.value = list[0]?.id ?? null;
  return list;
}

export function upsertProject(p: Project): void {
  const list = projects.value;
  const i = list.findIndex((x) => x.id === p.id);
  projects.value = i === -1 ? [...list, p] : [...list.slice(0, i), p, ...list.slice(i + 1)];
}
