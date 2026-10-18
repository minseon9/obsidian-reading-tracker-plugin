import { requestUrl } from 'obsidian';

/**
 * Fetch and parse JSON through Obsidian's own request API, which works the same
 * on desktop and mobile and is not subject to browser CORS rules.
 */
export async function getJson<T>(url: string): Promise<T> {
	const response = await requestUrl({ url, method: 'GET', throw: false });

	if (response.status >= 400) {
		throw new Error(`Request failed with status ${response.status}`);
	}
	return response.json as T;
}
