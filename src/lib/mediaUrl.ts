export interface MediaUrlOptions {
	basePath: string;
}

export const isExternalMediaUrl = (value: string) => /^https?:\/\//i.test(value);

export const isAbsoluteMediaPath = (value: string) => value.startsWith('/');

export const resolveMediaUrl = (value: string, { basePath }: MediaUrlOptions) => {
	if (isExternalMediaUrl(value) || isAbsoluteMediaPath(value)) return value;

	const normalizedBasePath = `/${basePath.replace(/^\/+|\/+$/g, '')}`;
	return `${normalizedBasePath}/${encodeURIComponent(value)}`;
};
