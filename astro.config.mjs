// @ts-check
import { defineConfig } from 'astro/config';
import keystatic from '@keystatic/astro';
import markdoc from '@astrojs/markdoc';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
	adapter: vercel(),
	integrations: [react(), markdoc(), keystatic()],
});
