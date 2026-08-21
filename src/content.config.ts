import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
	schema: z.object({
		order: z.number().optional(),
		title: z.string(),
		description: z.string(),
		services: z.array(z.string()).default([]),
		images: z.array(z.string()),
	}),
});

export const collections = { projects };
