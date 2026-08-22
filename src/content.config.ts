import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
	schema: z.object({
		order: z.number().optional(),
		title_zh: z.string(),
		title_en: z.string(),
		description_zh: z.string(),
		description_en: z.string(),
		services: z.array(z.string()).default([]),
		video: z.array(z.string()).default([]),
		videoCover: z.array(z.string()).default([]),
		images: z.array(z.string()),
	}),
});

const series = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/series' }),
	schema: z.object({
		draft: z.boolean().default(false),
		order: z.number().optional(),
		title_zh: z.string(),
		title_en: z.string(),
		description_zh: z.string(),
		description_en: z.string(),
		cover: z.string(),
	}),
});

export const collections = { projects, series };
