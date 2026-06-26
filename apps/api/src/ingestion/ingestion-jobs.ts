import type { IngestionJob, IngestionJobKind, IngestionJobResult } from "@legal-rag/shared";

type JobUpdate = Partial<Pick<IngestionJob, "progress" | "message">>;
type JobTask = (update: (patch: JobUpdate) => void) => Promise<IngestionJobResult>;

export class InMemoryIngestionJobQueue {
  private readonly jobs = new Map<string, IngestionJob>();

  submit(input: { projectId: string; kind: IngestionJobKind; title: string }, task: JobTask): IngestionJob {
    const now = new Date().toISOString();
    const job: IngestionJob = {
      id: `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      projectId: input.projectId,
      kind: input.kind,
      title: input.title,
      status: "queued",
      progress: 0,
      message: "等待处理",
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(job.id, job);

    queueMicrotask(() => {
      void this.run(job.id, task);
    });

    return job;
  }

  get(jobId: string): IngestionJob | undefined {
    return this.jobs.get(jobId);
  }

  list(projectId?: string, limit = 20): IngestionJob[] {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    return [...this.jobs.values()]
      .filter((job) => !projectId || job.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, safeLimit);
  }

  private async run(jobId: string, task: JobTask): Promise<void> {
    this.patch(jobId, {
      status: "running",
      progress: 5,
      message: "开始处理"
    });

    try {
      const result = await task((patch) => this.patch(jobId, patch));
      this.patch(jobId, {
        status: "succeeded",
        progress: 100,
        message: "处理完成",
        result,
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      this.patch(jobId, {
        status: "failed",
        progress: 100,
        message: "处理失败",
        error: error instanceof Error ? error.message : "ingestion failed",
        completedAt: new Date().toISOString()
      });
    }
  }

  private patch(jobId: string, patch: Partial<IngestionJob>): void {
    const current = this.jobs.get(jobId);
    if (!current) {
      return;
    }
    this.jobs.set(jobId, {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    });
  }
}
