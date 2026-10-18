import { App, TFile, normalizePath } from 'obsidian';
import { Book } from '../../models/book';
import { FolderManager } from '../pathService/folderManager';
import { FileNameGenerator } from '../pathService/fileNameGenerator';
import { PathManager } from '../pathService/pathManager';
import { FrontmatterConverter } from '../frontmatterService/frontmatterConverter';
import { NoteAccess } from '../frontmatterService/noteAccess';

export class BookFileCreator {
	private app: App;
	private folderManager: FolderManager;

	constructor(app: App) {
		this.app = app;
		this.folderManager = new FolderManager(app);
	}

	/**
	 * Create a book note.
	 *
	 * The body is written first and the properties are then filled in through
	 * `processFrontMatter`, so Obsidian serialises them exactly the way it does
	 * for a note the reader edits by hand.
	 */
	async create(book: Book, baseFolder: string): Promise<TFile> {
		const booksFolder = PathManager.getBooksFolderPath(baseFolder);
		await this.folderManager.ensureFolder(booksFolder);

		const fileName = FileNameGenerator.generate(book.title);
		const filePath = normalizePath(`${booksFolder}/${fileName}.md`);

		if (this.app.vault.getFileByPath(filePath)) {
			throw new Error(`Book note already exists: ${filePath}`);
		}

		const file = await this.app.vault.create(filePath, BookFileCreator.body(book));

		const properties = FrontmatterConverter.newBookFrontmatter(book);
		await NoteAccess.updateFrontmatter(this.app, file, (frontmatter) => {
			Object.assign(frontmatter, properties);
		});

		return file;
	}

	/**
	 * The starting body of a book note: a heading and the cover, if there is one.
	 * Everything else the reader adds themselves, and sessions are appended
	 * below as they read.
	 */
	private static body(book: Book): string {
		const lines = [`# ${book.title}`];
		if (book.coverUrl) {
			lines.push('', `![cover|150](${book.coverUrl})`);
		}
		return `${lines.join('\n')}\n`;
	}
}
