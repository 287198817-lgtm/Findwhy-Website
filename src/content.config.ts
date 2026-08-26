import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
	schema: z.object({
		draft: z.boolean().default(false),
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
	loader: glob({ pattern: ['**/*.md', '!_template.md'], base: './src/content/series' }),
	schema: z.object({
		draft: z.boolean().default(false),
		order: z.number().optional(),
		title_zh: z.string(),
		title_en: z.string(),
		description_zh: z.string(),
		description_en: z.string(),
		cover_image: z.string(),
		gallery_images: z.array(z.string()).default([]),
	}),
});

const illustrations = defineCollection({
	loader: glob({ pattern: ['**/*.md', '!_template.md'], base: './src/content/illustrations' }),
	schema: z.object({
		draft: z.boolean().default(false),
		order: z.number().default(0),
		slug: z.string().default(''),
		image: z.string(),
	}),
});

const animations = defineCollection({
	loader: glob({ pattern: ['**/*.md', '!_template.md'], base: './src/content/animations' }),
	schema: z.object({
		draft: z.boolean().default(false),
		order: z.number().default(0),
		slug: z.string().default(''),
		video: z.string(),
	}),
});

const about = defineCollection({
	loader: glob({ pattern: 'about.md', base: './src/content/about' }),
	schema: z.object({
		intro_zh: z.array(z.string()),
		intro_en: z.array(z.string()),
		portrait: z.string(),
		services_title_zh: z.string(),
		services_title_en: z.string(),
		services_zh: z.array(z.string()),
		services_en: z.array(z.string()),
		clients_title_zh: z.string(),
		clients_title_en: z.string(),
		clients: z.array(z.string()),
		contact_title_zh: z.string(),
		contact_title_en: z.string(),
		email: z.string(),
		instagram_url: z.string(),
		xiaohongshu_url: z.string(),
	}),
});

export const collections = { projects, series, illustrations, animations, about };
