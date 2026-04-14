import { z } from 'zod';
import { insertRecordingSchema, insertFeedbackSchema, recordings, feedback } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  recordings: {
    list: {
      method: 'GET' as const,
      path: '/api/recordings' as const,
      responses: {
        200: z.array(z.any()), // Frontend will infer from usage, keeping simple for now
      },
    },
    listPending: {
      method: 'GET' as const,
      path: '/api/recordings/pending' as const,
      responses: {
        200: z.array(z.any()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/recordings/:id' as const,
      responses: {
        200: z.any(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/recordings' as const,
      input: insertRecordingSchema.extend({ rerecordOf: z.number().optional() }),
      responses: {
        201: z.any(),
        400: errorSchemas.validation,
      },
    },
  },
  feedback: {
    create: {
      method: 'POST' as const,
      path: '/api/recordings/:id/feedback' as const,
      input: insertFeedbackSchema,
      responses: {
        201: z.any(),
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
