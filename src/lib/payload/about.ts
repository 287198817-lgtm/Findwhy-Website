import { payloadFetch } from './client';
import { getImageUrls, type PayloadImage } from './media';

interface PayloadTextItem {
	text?: string | null;
}

interface PayloadAbout {
	intro_zh?: PayloadTextItem[] | null;
	intro_en?: PayloadTextItem[] | null;
	portrait?: PayloadImage | number | string | null;
	services_title_zh?: string | null;
	services_title_en?: string | null;
	services_zh?: PayloadTextItem[] | null;
	services_en?: PayloadTextItem[] | null;
	clients_title_zh?: string | null;
	clients_title_en?: string | null;
	clients?: PayloadTextItem[] | null;
	contact_title_zh?: string | null;
	contact_title_en?: string | null;
	email?: string | null;
	instagram_url?: string | null;
	xiaohongshu_url?: string | null;
}

export interface AboutContent {
	introZh: string[];
	introEn: string[];
	portrait?: string;
	portraitPreviewUrl?: string;
	servicesTitleZh: string;
	servicesTitleEn: string;
	servicesZh: string[];
	servicesEn: string[];
	clientsTitleZh: string;
	clientsTitleEn: string;
	clients: string[];
	contactTitleZh: string;
	contactTitleEn: string;
	email: string;
	instagramUrl: string;
	xiaohongshuUrl: string;
}

const emptyAbout: AboutContent = {
	introZh: [],
	introEn: [],
	servicesTitleZh: '',
	servicesTitleEn: '',
	servicesZh: [],
	servicesEn: [],
	clientsTitleZh: '',
	clientsTitleEn: '',
	clients: [],
	contactTitleZh: '',
	contactTitleEn: '',
	email: '',
	instagramUrl: '',
	xiaohongshuUrl: '',
};

const textItems = (items?: PayloadTextItem[] | null) =>
	(items ?? [])
		.map((item) => item.text?.trim())
		.filter((text): text is string => Boolean(text));

export const getAbout = async (): Promise<AboutContent> => {
	try {
		const about = await payloadFetch<PayloadAbout>('/api/globals/about?depth=1');
		const portrait = getImageUrls(about.portrait);

		return {
			introZh: textItems(about.intro_zh),
			introEn: textItems(about.intro_en),
			portrait: portrait?.fullUrl,
			portraitPreviewUrl: portrait?.previewUrl,
			servicesTitleZh: about.services_title_zh ?? '',
			servicesTitleEn: about.services_title_en ?? '',
			servicesZh: textItems(about.services_zh),
			servicesEn: textItems(about.services_en),
			clientsTitleZh: about.clients_title_zh ?? '',
			clientsTitleEn: about.clients_title_en ?? '',
			clients: textItems(about.clients),
			contactTitleZh: about.contact_title_zh ?? '',
			contactTitleEn: about.contact_title_en ?? '',
			email: about.email ?? '',
			instagramUrl: about.instagram_url ?? '',
			xiaohongshuUrl: about.xiaohongshu_url ?? '',
		};
	} catch (error) {
		console.error('Unable to load About content from Payload:', error);
		return emptyAbout;
	}
};
