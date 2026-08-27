// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
	adapter: vercel(),
	redirects: {
		'/illustration/gh': {
			destination: '/series/explosion',
			status: 301,
		},
	},
});
