import { collection, config, fields, singleton } from '@keystatic/core';
import { createElement, useRef, useState } from 'react';

interface OptimizedImageOptions {
	label: string;
	maxWidth: number;
	quality: number;
}

const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const canvasToWebP = async (canvas: HTMLCanvasElement, quality: number) => {
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
	if (!blob) throw new Error('浏览器无法生成 WebP 图片。');
	return blob;
};

const optimizedImage = ({ label, maxWidth, quality }: OptimizedImageOptions) => {
	const imageField = fields.image({
		label,
		directory: 'public/media/series',
		publicPath: '/media/series/',
		validation: { isRequired: true },
	});
	const ImageInput = imageField.Input;

	return {
		...imageField,
		Input(props: Parameters<typeof ImageInput>[0]) {
			const [status, setStatus] = useState('');
			const operation = useRef(0);

			const onChange = async (value: Parameters<typeof props.onChange>[0]) => {
				const operationId = ++operation.current;
				if (!value) {
					setStatus('');
					props.onChange(value);
					return;
				}

				setStatus('正在处理图片…');
				await nextPaint();

				try {
					const source = new Blob([value.data]);
					const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
					const scale = Math.min(1, maxWidth / bitmap.width);
					const width = Math.max(1, Math.round(bitmap.width * scale));
					const height = Math.max(1, Math.round(bitmap.height * scale));
					const canvas = document.createElement('canvas');
					canvas.width = width;
					canvas.height = height;
					const context = canvas.getContext('2d');
					if (!context) throw new Error('浏览器无法创建图片处理画布。');
					context.drawImage(bitmap, 0, 0, width, height);
					bitmap.close();
					const output = await canvasToWebP(canvas, quality);
					if (operation.current !== operationId) return;

					const originalBaseName = value.filename.replace(/\.[^.]+$/, '');
					props.onChange({
						data: new Uint8Array(await output.arrayBuffer()),
						extension: 'webp',
						filename: `${originalBaseName}.webp`,
					});
					setStatus(`处理完成 · ${width} × ${height} · WebP`);
				} catch (error) {
					if (operation.current !== operationId) return;
					setStatus(error instanceof Error ? `处理失败：${error.message}` : '图片处理失败，请重新选择。');
				}
			};

			return createElement(
				'div',
				{ style: { display: 'grid', gap: '8px' } },
				createElement(ImageInput, { ...props, onChange }),
				status && createElement(
					'div',
					{
						role: 'status',
						'aria-live': 'polite',
						style: { fontSize: '12px', lineHeight: 1.5, opacity: 0.72 },
					},
					status,
				),
			);
		},
	};
};

const requiredText = (label: string, multiline = false) =>
	fields.text({
		label,
		multiline,
		validation: { isRequired: true },
	});

const stringList = (label: string, itemLabel: string) =>
	fields.array(fields.text({ label: itemLabel }), {
		label,
		itemLabel: (props) => props.value || itemLabel,
	});

const githubStorage = {
	kind: 'github' as const,
	repo: '287198817-lgtm/Findwhy-Website-CMS' as const,
};

export default config({
	storage: import.meta.env.DEV ? { kind: 'local' } : githubStorage,
	ui: {
		brand: { name: 'Findwhy CMS' },
	},
	collections: {
		projects: collection({
			label: '项目',
			path: 'src/content/projects/*',
			slugField: 'title_en',
			columns: ['title_en', 'title_zh', 'order', 'draft'],
			format: { contentField: '_content' },
			schema: {
				title_zh: requiredText('中文标题'),
				title_en: fields.slug({
					name: {
						label: '英文标题',
						validation: { isRequired: true },
					},
					slug: {
						label: '网址标识',
						description: '用于项目网址和 Markdown 文件名。',
					},
				}),
				description_zh: requiredText('中文介绍', true),
				description_en: requiredText('英文介绍', true),
				services: stringList('服务内容', '服务项目'),
				images: stringList('图片列表', '图片路径'),
				video: stringList('视频', '视频路径或网址'),
				videoCover: stringList('视频封面', '封面路径或网址'),
				order: fields.integer({ label: '排序' }),
				draft: fields.checkbox({ label: '草稿（不发布）', defaultValue: false }),
				_content: fields.emptyContent({ extension: 'md' }),
			},
		}),
		series: collection({
			label: '系列',
			path: 'src/content/series/*',
			slugField: 'title_en',
			columns: ['title_en', 'title_zh', 'order', 'draft'],
			format: { contentField: '_content' },
			schema: {
				title_zh: requiredText('中文标题'),
				title_en: fields.slug({
					name: {
						label: '英文标题',
						validation: { isRequired: true },
					},
					slug: {
						label: '网址标识',
						description: '用于系列网址和 Markdown 文件名。',
					},
				}),
				description_zh: requiredText('中文介绍', true),
				description_en: requiredText('英文介绍', true),
				cover_image: optimizedImage({
					label: '封面图片',
					maxWidth: 2000,
					quality: 0.86,
				}),
				gallery_images: fields.array(
					optimizedImage({
						label: '系列图片',
						maxWidth: 2500,
						quality: 0.84,
					}),
					{
						label: '系列图片（Gallery Images）',
						itemLabel: (props) => props.value?.filename || '系列图片',
					},
				),
				order: fields.integer({ label: '排序' }),
				draft: fields.checkbox({ label: '草稿（不发布）', defaultValue: false }),
				_content: fields.emptyContent({ extension: 'md' }),
			},
		}),
		illustrations: collection({
			label: '插画',
			path: 'src/content/illustrations/*',
			slugField: 'slug',
			columns: ['image', 'order', 'draft'],
			format: { contentField: '_content' },
			schema: {
				slug: fields.slug({
					name: { label: '文件名', validation: { isRequired: true } },
					slug: { label: '网址标识', description: '用于 Markdown 文件名。' },
				}),
				image: fields.image({
					label: '插画图片',
					directory: 'public/media/illustration',
					publicPath: '/media/illustration/',
					validation: { isRequired: true },
				}),
				order: fields.integer({ label: '排序', defaultValue: 0 }),
				draft: fields.checkbox({ label: '草稿（不发布）', defaultValue: false }),
				_content: fields.emptyContent({ extension: 'md' }),
			},
		}),
		animations: collection({
			label: '动画',
			path: 'src/content/animations/*',
			slugField: 'slug',
			columns: ['video', 'order', 'draft'],
			format: { contentField: '_content' },
			schema: {
				slug: fields.slug({
					name: { label: '文件名', validation: { isRequired: true } },
					slug: { label: '网址标识', description: '用于 Markdown 文件名。' },
				}),
				video: fields.file({
					label: '动画文件',
					directory: 'public/media/animation',
					publicPath: '/media/animation/',
					validation: { isRequired: true },
				}),
				order: fields.integer({ label: '排序', defaultValue: 0 }),
				draft: fields.checkbox({ label: '草稿（不发布）', defaultValue: false }),
				_content: fields.emptyContent({ extension: 'md' }),
			},
		}),
	},
	singletons: {
		about: singleton({
			label: '关于',
			path: 'src/content/about/about',
			format: { contentField: '_content' },
			schema: {
				intro_zh: stringList('中文介绍段落', '中文段落'),
				intro_en: stringList('英文介绍段落', '英文段落'),
				portrait: requiredText('个人图片'),
				services_title_zh: requiredText('服务栏目中文标题'),
				services_title_en: requiredText('服务栏目英文标题'),
				services_zh: stringList('中文服务内容', '中文服务'),
				services_en: stringList('英文服务内容', '英文服务'),
				clients_title_zh: requiredText('客户栏目中文标题'),
				clients_title_en: requiredText('客户栏目英文标题'),
				clients: stringList('合作客户', '客户'),
				contact_title_zh: requiredText('联系方式中文标题'),
				contact_title_en: requiredText('联系方式英文标题'),
				email: requiredText('电子邮箱'),
				instagram_url: requiredText('Instagram 地址'),
				xiaohongshu_url: requiredText('小红书地址'),
				_content: fields.emptyContent({ extension: 'md' }),
			},
		}),
	},
});
