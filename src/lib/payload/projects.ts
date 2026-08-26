import { payloadFetch, resolvePayloadMediaUrl } from './client';

interface PayloadImage {
	url?: string | null;
}

interface PayloadVideo {
	url?: string | null;
	poster?: PayloadImage | number | string | null;
}

interface PayloadService {
	service?: string | null;
}

interface PayloadProject {
	id: number | string;
	slug: string;
	title_zh: string;
	title_en?: string | null;
	description_zh?: string | null;
	description_en?: string | null;
	services?: PayloadService[] | null;
	coverImage?: PayloadImage | number | string | null;
	images?: Array<PayloadImage | number | string> | null;
	video?: Array<PayloadVideo | number | string> | null;
	videoCover?: Array<PayloadImage | number | string> | null;
	year?: number | null;
	category?: string | null;
	type?: string | null;
	order?: number | null;
	draft?: boolean | null;
}

interface PayloadCollectionResponse<T> {
	docs: T[];
	hasNextPage: boolean;
	nextPage: number | null;
}

export interface ProjectVideo {
	src: string;
	cover?: string;
}

export interface ProjectItem {
	slug: string;
	titleZh: string;
	titleEn: string;
	descriptionZh: string;
	descriptionEn: string;
	services: string[];
	coverImage?: string;
	images: string[];
	videos: ProjectVideo[];
	year?: number;
	type?: string;
	order: number;
}

const getMediaUrl = (media: PayloadImage | PayloadVideo | number | string | null | undefined) => {
	if (!media || typeof media !== 'object' || !media.url) return null;
	return resolvePayloadMediaUrl(media.url);
};

const mapProject = (document: PayloadProject): ProjectItem => {
	const covers = document.videoCover ?? [];
	const videos = (document.video ?? [])
		.map((video, index) => {
			const src = getMediaUrl(video);
			if (!src) return null;
			const relatedPoster = typeof video === 'object' ? video.poster : null;

			return {
				src,
				cover: getMediaUrl(covers[index]) ?? getMediaUrl(relatedPoster) ?? undefined,
			};
		})
		.filter((video): video is ProjectVideo => video !== null);

	return {
		slug: document.slug,
		titleZh: document.title_zh,
		titleEn: document.title_en?.trim() || document.title_zh,
		descriptionZh: document.description_zh ?? '',
		descriptionEn: document.description_en ?? '',
		services: (document.services ?? [])
			.map((service) => service.service?.trim())
			.filter((service): service is string => Boolean(service)),
		coverImage: getMediaUrl(document.coverImage) ?? undefined,
		images: (document.images ?? [])
			.map(getMediaUrl)
			.filter((image): image is string => Boolean(image)),
		videos,
		year: document.year ?? undefined,
		type: document.type?.trim() || document.category?.trim() || undefined,
		order: document.order ?? Number.POSITIVE_INFINITY,
	};
};

export const getProjects = async (): Promise<ProjectItem[]> => {
	const documents: PayloadProject[] = [];
	let page = 1;

	do {
		const params = new URLSearchParams({
			depth: '2',
			limit: '100',
			page: String(page),
			sort: 'order',
		});
		const response = await payloadFetch<PayloadCollectionResponse<PayloadProject>>(
			`/api/projects?${params}`,
		);

		documents.push(...response.docs);
		page = response.hasNextPage && response.nextPage ? response.nextPage : 0;
	} while (page > 0);

	return documents
		.filter((document) => document.draft !== true)
		.map(mapProject)
		.sort((a, b) => a.order - b.order
			|| a.slug.localeCompare(b.slug, undefined, { numeric: true, sensitivity: 'base' }));
};

export const getProjectBySlug = async (slug: string): Promise<ProjectItem | null> => {
	const params = new URLSearchParams({
		depth: '2',
		limit: '1',
		'where[slug][equals]': slug,
	});
	const response = await payloadFetch<PayloadCollectionResponse<PayloadProject>>(
		`/api/projects?${params}`,
	);
	const document = response.docs.find((project) => project.draft !== true);

	return document ? mapProject(document) : null;
};
