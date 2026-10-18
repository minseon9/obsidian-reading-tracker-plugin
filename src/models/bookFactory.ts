import { Book } from './book';

export function createBookFromData(data: Partial<Book>): Book {
	return {
		title: data.title || 'Unknown title',
		subtitle: data.subtitle,
		author: data.author || [],
		isbn: data.isbn,
		publisher: data.publisher,
		publishDate: data.publishDate,
		totalPages: data.totalPages,
		coverUrl: data.coverUrl,
		category: data.category || [],
		series: data.series,
		seriesPosition: data.seriesPosition,
		status: data.status || 'unread',
		readingUnit: data.readingUnit || 'pages',
		readPage: data.readPage || 0,
		rating: data.rating,
		readStarted: data.readStarted,
		readFinished: data.readFinished,
	};
}
