import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { isExternalMediaUrl, resolveMediaUrl } from './mediaUrl';

const imagePattern = /\.(?:jpe?g|png|webp)$/i;
const numericSort = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare;

const seriesDirectory = (slug: string) => join(process.cwd(), 'public', 'media', 'series', slug);

export const getSeriesImages = (slug: string, coverImage: string) => {
	const coverImageName = isExternalMediaUrl(coverImage)
		? basename(new URL(coverImage).pathname)
		: basename(coverImage);
	const excludedCovers = new Set([coverImageName.toLocaleLowerCase()]);

	return readdirSync(seriesDirectory(slug), { withFileTypes: true })
		.filter((entry) => entry.isFile() && imagePattern.test(entry.name) && !excludedCovers.has(entry.name.toLocaleLowerCase()))
		.map((entry) => entry.name)
		.sort(numericSort)
		.map((file, index) => ({
			kind: 'image' as const,
			src: resolveMediaUrl(file, { basePath: `/media/series/${slug}` }),
			number: index + 1,
		}));
};
