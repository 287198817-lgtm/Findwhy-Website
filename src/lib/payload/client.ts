const payloadApiUrl = import.meta.env.PAYLOAD_API_URL?.replace(/\/+$/, '');

if (!payloadApiUrl) {
	throw new Error('PAYLOAD_API_URL is required to read content from Payload CMS.');
}

export const payloadFetch = async <T>(path: string): Promise<T> => {
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	const response = await fetch(`${payloadApiUrl}${normalizedPath}`);

	if (!response.ok) {
		throw new Error(`Payload API request failed (${response.status}): ${normalizedPath}`);
	}

	return response.json() as Promise<T>;
};

export const resolvePayloadMediaUrl = (value: string) => {
	if (/^https?:\/\//i.test(value)) return value;

	const normalizedPath = value.startsWith('/') ? value : `/${value}`;
	return `${payloadApiUrl}${normalizedPath}`;
};
