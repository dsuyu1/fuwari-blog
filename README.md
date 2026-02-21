# 🍥Fuwari  
A static blog template built with [Astro](https://astro.build).

## ✨ Features

- [x] Built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com)
- [x] Smooth animations and page transitions
- [x] Light / dark mode
- [x] Customizable theme colors & banner
- [x] Responsive design
- [x] Search functionality with [Pagefind](https://pagefind.app/)
- [x] [Markdown extended features](https://github.com/saicaca/fuwari?tab=readme-ov-file#-markdown-extended-syntax)
- [x] Table of contents
- [x] RSS feed

## ✏️ Contributing

Check out the [Contributing Guide](https://github.com/saicaca/fuwari/blob/main/CONTRIBUTING.md) for details on how to contribute to this project.

## 📸 Asset handling

By default Astro only serves files from the `public/` directory at build time. Images placed in `src/assets` are available during development (Vite proxies them) but are **not** copied to the final output unless you explicitly import them. That means markdown references such as:

```md
![diagram](/src/assets/images/diagram.png)
```

will 404 in production. To avoid broken images:

1. **Put static media in `public/`** and refer to it with an absolute path (e.g. `/images/diagram.png`).
2. If you prefer to keep assets in `src`, import them in your component or frontmatter and use the resulting URL: 
   ```astro
   ---
   import pic from '../assets/images/diagram.png';
   ---
   <img src={pic} alt="..." />
   ```

The sample post `Signature Verification Challenge.md` has been updated to demonstrate the first approach – the two PNGs should be moved from `src/assets/images/` into `public/`.


## 📄 License

This project is licensed under the MIT License.

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fsaicaca%2Ffuwari.svg?type=large&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2Fsaicaca%2Ffuwari?ref=badge_large&issueType=license)
