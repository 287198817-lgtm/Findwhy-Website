import { existsSync, readdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const imagePattern = /\.(?:jpe?g|png|webp)$/i;
const coverExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
const numericSort = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare;

const seriesDirectory = (slug: string) => join(process.cwd(), 'public', 'media', 'series', slug);
const isExternal = (file: string) => /^https?:\/\//i.test(file);

const coverCandidates = (cover: string) => {
	if (isExternal(cover) || cover.startsWith('/')) return [];
	return extname(cover) ? [basename(cover)] : coverExtensions.map((extension) => `${cover}${extension}`);
};

export const resolveSeriesCover = (slug: string, cover: string) => {
	if (isExternal(cover) || cover.startsWith('/')) return cover;

	const candidates = coverCandidates(cover);
	const fileName = candidates.find((candidate) => existsSync(join(seriesDirectory(slug), candidate)))
		?? candidates[0]
		?? cover;

	return `/media/series/${slug}/${encodeURIComponent(fileName)}`;
};

export const getSeriesImages = (slug: string, cover: string) => {
	const excludedCovers = new Set(coverCandidates(cover).map((file) => file.toLocaleLowerCase()));

	return readdirSync(seriesDirectory(slug), { withFileTypes: true })
		.filter((entry) => entry.isFile() && imagePattern.test(entry.name) && !excludedCovers.has(entry.name.toLocaleLowerCase()))
		.map((entry) => entry.name)
		.sort(numericSort)
		.map((file, index) => ({
			kind: 'image' as const,
			src: `/media/series/${slug}/${encodeURIComponent(file)}`,
			number: index + 1,
		}));
};
