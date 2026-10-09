# vitrine

Portfólio estático de Eduardo Lorenzo ([srlorenzos](https://github.com/srlorenzos)) com demos que rodam no navegador. HTML, CSS e JavaScript puros, sem framework e sem CDN. Publicado na Netlify.

## Estrutura

- `index.html`, `assets/`: página inicial. A lista de projetos fica em `assets/projetos.js` (para ativar o farol-rmm, troque `status` para `"pronto"` e preencha `demo`).
- `demos/<projeto>/`: uma demo por projeto, todas com dados fictícios.
- `scripts/gerar-dados.mjs`: gera `demos/painel-organizze/api/*.json` (12 meses) a partir de `../painel-organizze`.
- `netlify.toml`: publicação sem build, cabeçalhos de segurança e cache.

## Rodar localmente

```bash
python -m http.server 8090   # ou: npx serve
```

Abra <http://localhost:8090>. As páginas usam caminhos absolutos (`/assets/...`), então sirva a partir da raiz desta pasta.

## Atualizar as demos

```bash
node scripts/gerar-dados.mjs                 # painel-organizze (precisa da pasta ../painel-organizze)
# resumo-do-dia: rode `npm run demo` no projeto e copie previa.html para demos/resumo-do-dia/
# email-para-tarefa: copie src/interpretar.js e src/datas.js para demos/email-para-tarefa/lib/
```

## Licença

MIT © Eduardo Lorenzo
