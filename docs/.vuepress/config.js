const fs = require("fs");
const path = require("path");
const nav = require("./nav");
module.exports = {
	title: "LocaleSail for Vue i18n",
	description: "在 VS Code 中提取中文文案、生成 locale key 并维护 Vue 国际化文件",
	head: [["link", { rel: "icon", href: "/logo.png" }]],
	themeConfig: {
		logo: "/logo.png",
		smoothScroll: true,
		nav,
		sidebar: {
			"/guide/": getAutoSideBar([
				{ title: "指南", path: "../guide", children: ["into"] },
				{
					title: "深入",
					path: "../guide",
					children: ["1-update-i18n", "2-replace-i18n", "3-show-i18n", "4-other", "5-split-i18n"],
				},
			]),
			"/config/": getAutoSideBar([{ title: "配置", path: "../config" }]),
			"/inspiration/": getAutoSideBar([
				{ title: "楔子", path: "../inspiration" },
			]),
		},
	},
};

function getAutoSideBar(groups) {
	return groups.map((v, p) => ({
		title: v.title,
		collapsable: !!v.collapsable,
		children: [
			...(fs.existsSync(path.resolve(__dirname, v.path, "README.md")) ? [""] : []),
			...fs
				.readdirSync(path.resolve(__dirname, v.path))
				.map((m) => m.slice(0, -3))
				.filter((m) =>
					Array.isArray(v.children) ? v.children.includes(m) : m !== "README"
				)
				.sort(),
		].filter((m, n) => p === 0 || n !== 0),
	}));
}
function getGuideSidebar(groupA, groupB) {
	return [
		{
			title: groupA,
			collapsable: false,
			children: ["", "one"],
		},
		{
			title: groupB,
			collapsable: false,
			children: ["two"],
		},
	];
}
