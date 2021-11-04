export async function GetUserFile(endings: string[]): Promise<File> {
	return new Promise((resolve, reject) => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = ''
		for (let i = 0; i < endings.length; i++) {
			input.accept += '.' + endings[i]
			if (i < endings.length - 1) {
				input.accept += ','
			}
		}
		input.onchange = async () => {
			const files = input.files
			if (files == null || files.length == 0) {
				return
			}
			const file = files[0]
			const sep = file.name.split('.')
			const format = sep[sep.length - 1]
			if (endings.includes(format)) {
				resolve(file)
			} else {
				reject('format "' + format + '" not supported')
			}
		}
		input.click()
	})
}
