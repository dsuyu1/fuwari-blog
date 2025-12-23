import banner5 from "./assets/banner/5.jpg";
import banner7_1 from "./assets/banner/7(1).jpg";
import banner16 from "./assets/banner/16.jpg";
import banner16_1 from "./assets/banner/16[1].jpg";
import banner20 from "./assets/banner/20.jpg";
import banner20_1 from "./assets/banner/20(1).jpg";
import banner21 from "./assets/banner/21.jpg";
import banner21_1 from "./assets/banner/21[1].jpg";
import banner22 from "./assets/banner/22.jpg";
import banner25 from "./assets/banner/25.jpg";
import banner251 from "./assets/banner/251.jpg";

import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "damian villarreal",
	subtitle: "my place for things I like to talk about",
	lang: "en", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
	themeColor: {
		hue: 40, // Default hue for the theme color, from 0 to 360. e.g. red: 0, teal: 200, cyan: 250, pink: 345
		fixed: false, // Hide the theme color picker for visitors
	},
	banner: {
		enable: false,
		src: [
			banner5.src,
			banner16.src,
			banner16_1.src,
			banner20.src,
			banner21.src,
			banner21_1.src,
			banner25.src,
			banner251.src,
			banner7_1.src,
			banner22.src,
			banner20_1.src,
		],
		position: "center",
		autoRotate: false,
		interval: 6000,
		credit: {
			enable: false, // Display the credit text of the banner image
			text: "Summer 2025, South Korea", // Credit text to be displayed
			// url: "https://www.pixiv.net/en/artworks/137161856", // (Optional) URL link to the original artwork or artist's page
		},
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 2, // Maximum heading depth to show in the table, from 1 to 3
	},
	favicon: [
		// Leave this array empty to use the default favicon
		// {
		//   src: '/favicon/icon.png',    // Path of the favicon, relative to the /public directory
		//   theme: 'light',              // (Optional) Either 'light' or 'dark', set only if you have different favicons for light and dark mode
		//   sizes: '32x32',              // (Optional) Size of the favicon, set only if you have favicons of different sizes
		// }
	],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.Projects, // using the preset now so we can support multiple languages
		LinkPreset.Research, // added to have Research tab now
		LinkPreset.About,

		{
			name: "GitHub",
			url: "https://github.com/dsuyu1", // Internal links should not include the base path, as it is automatically added
			external: true, // Show an external link icon and will open in a new tab
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/hamada.jpg", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
	name: "Damian Villarreal",
	bio: "RSOC Student Analyst | Undergraduate Researcher | Computer Science @ UTRGV '26",
	links: [
		{
			name: "LinkedIn",
			icon: "cib:linkedin", // Visit https://icones.js.org/ for icon codes
			// You will need to install the corresponding icon set if it's not already included
			// `pnpm add @iconify-json/<icon-set-name>`
			url: "https://www.linkedin.com/in/dsuyu",
		},
		{
			name: "YouTube",
			icon: "cib:youtube",
			url: "https://www.youtube.com/@dsuyu1",
		},
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/dsuyu1",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: false,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
	// Please select a dark theme, as this blog theme currently only supports dark background color
	theme: "github-dark",
};
