import { payloadFetch, resolvePayloadMediaUrl } from './client';
import { getImageUrls, type ImageUrls, type PayloadImage } from './media';

interface PayloadVideo { url?: string | null; poster?: PayloadImage | number | string | null }
interface PayloadSeries {
	id: number | string; slug: string; title_zh: string; title_en: string;
	description_zh?: string | null; description_en?: string | null; year?: number | null;
	cover?: PayloadImage | number | string | null;
	images?: Array<PayloadImage | number | string> | null;
	videos?: Array<PayloadVideo | number | string> | null;
	cover_image?: PayloadImage | number | string | null;
	gallery_images?: Array<PayloadImage | number | string> | null;
	order?: number | null; draft?: boolean | null;
}
interface PayloadCollectionResponse<T> { docs: T[]; hasNextPage: boolean; nextPage: number | null }

export interface SeriesVideo { src: string; poster?: string; posterPreviewUrl?: string }
export interface SeriesItem {
	slug: string; titleZh: string; titleEn: string; descriptionZh: string; descriptionEn: string;
	year?: number; images: string[]; imageMedia: ImageUrls[]; videos: SeriesVideo[];
	cover?: string; coverPreviewUrl?: string; order: number;
}

const mediaUrl = (media: PayloadImage | PayloadVideo | number | string | null | undefined) => {
	if (!media || typeof media !== 'object' || !media.url) return null;
	return resolvePayloadMediaUrl(media.url);
};

const mapSeries = (document: PayloadSeries): SeriesItem => {
	const sourceImages = document.images?.length ? document.images : (document.gallery_images ?? []);
	const imageMedia = sourceImages.map(getImageUrls).filter((image): image is ImageUrls => image !== null);
	const images = imageMedia.map((image) => image.fullUrl);
	const videos = (document.videos ?? []).map((video) => {
		const src = mediaUrl(video);
		if (!src) return null;
		const poster = typeof video === 'object' ? getImageUrls(video.poster) : null;
		return {
			src,
			poster: poster?.fullUrl,
			posterPreviewUrl: poster?.previewUrl,
		};
	}).filter((video): video is SeriesVideo => video !== null);
	const cover = getImageUrls(document.cover) ?? getImageUrls(document.cover_image);
	return {
		slug: document.slug, titleZh: document.title_zh, titleEn: document.title_en,
		descriptionZh: document.description_zh ?? '', descriptionEn: document.description_en ?? '',
		year: document.year ?? undefined, images, imageMedia, videos,
		cover: cover?.fullUrl,
		coverPreviewUrl: cover?.previewUrl,
		order: document.order ?? Number.POSITIVE_INFINITY,
	};
};

export const getSeries = async (): Promise<SeriesItem[]> => {
	const documents: PayloadSeries[] = [];
	let page = 1;
	do {
		const params = new URLSearchParams({ depth: '2', limit: '100', page: String(page), sort: 'order' });
		const response = await payloadFetch<PayloadCollectionResponse<PayloadSeries>>(`/api/series?${params}`);
		documents.push(...response.docs);
		page = response.hasNextPage && response.nextPage ? response.nextPage : 0;
	} while (page > 0);
	return documents.filter((document) => document.draft !== true).map(mapSeries)
		.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug, undefined, { numeric: true }));
};

export const getSeriesBySlug = async (slug: string): Promise<SeriesItem | null> => {
	const params = new URLSearchParams({ depth: '2', limit: '1', 'where[slug][equals]': slug });
	const response = await payloadFetch<PayloadCollectionResponse<PayloadSeries>>(`/api/series?${params}`);
	const document = response.docs.find((item) => item.draft !== true);
	return document ? mapSeries(document) : null;
};
