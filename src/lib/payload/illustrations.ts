import { payloadFetch, resolvePayloadMediaUrl } from './client';

interface PayloadImage {
	url?: string | null;
}

interface PayloadIllustration {
	id: number | string;
	slug: string;
	image: PayloadImage | number | string | null;
	order?: number | null;
	draft?: boolean | null;
}

interface PayloadCollectionResponse<T> {
	docs: T[];
	hasNextPage: boolean;
	nextPage: number | null;
}

export interface IllustrationItem {
	slug: string;
	image: string;
	order: number;
}

const getImageUrl = (image: PayloadIllustration['image']) => {
	if (!image || typeof image !== 'object' || !image.url) return null;
	return resolvePayloadMediaUrl(image.url);
};

export const getIllustrations = async (): Promise<IllustrationItem[]> => {
	const documents: PayloadIllustration[] = [];
	let page = 1;

	do {
		const params = new URLSearchParams({
			depth: '1',
			limit: '100',
			page: String(page),
			sort: 'order',
		});
		const response = await payloadFetch<PayloadCollectionResponse<PayloadIllustration>>(
			`/api/illustrations?${params}`,
		);

		documents.push(...response.docs);
		page = response.hasNextPage && response.nextPage ? response.nextPage : 0;
	} while (page > 0);

	return documents
		.filter((document) => document.draft !== true)
		.map((document) => ({
			slug: document.slug,
			image: getImageUrl(document.image),
			order: document.order ?? Number.POSITIVE_INFINITY,
		}))
		.filter((document): document is IllustrationItem => Boolean(document.image))
		.sort((a, b) => a.order - b.order);
};
