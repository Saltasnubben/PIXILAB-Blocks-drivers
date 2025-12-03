declare module "system/SimpleFile" {
	export class SimpleFile {
		static read(fileName: string): Promise<string>;
		static readJson(fileName: string): Promise<any>;
		static write(fileName: string, data: string): Promise<void>;
		static append(fileName: string, data: string): Promise<void>;
		static exists(fileOrDirectory: string): number;
		static delete(fileOrDirectory: string, recursive?: boolean): Promise<void>;
		static move(src: string, dest: string, replace?: boolean): Promise<void>;
		static copy(src: string, dest: string, replace?: boolean): Promise<void>;
		static list(directory: string, leafNameOnly?: boolean): Promise<string[]>;
		static lastModified(path: string): Promise<number>;
	}
}
