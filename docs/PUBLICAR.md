# Publicar em HTTPS (gratuito)

A app é 100 % estática: basta servir o conteúdo de `dist/` por **HTTPS**. O HTTPS é obrigatório para o service worker (offline) e para instalar a PWA no iPhone. Como usa `HashRouter` e `base: './'`, funciona em qualquer subpasta e sem regras de *rewrite*.

```bash
npm install
npm run build        # gera dist/
```

## Opção A — Cloudflare Pages (arrastar e largar)

1. Cria conta em <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. Dá um nome ao projeto e arrasta a pasta `dist`.
3. Recebes `https://<nome>.pages.dev`. Abre no Safari do iPhone.

Atualizar: repete o build e faz novo upload. Ou liga um repositório Git com *build command* `npm run build` e *output directory* `dist`.

## Opção B — Netlify

1. <https://app.netlify.com/drop> → arrasta `dist`.
2. Recebes um endereço `https://<nome>.netlify.app`.

## Opção C — GitHub Pages

1. Cria um repositório e faz *push* do projeto.
2. Settings → Pages → Source: **GitHub Actions**. O workflow `.github/workflows/pages.yml` já está no projeto: corre os testes, faz o build e publica `dist` a cada *push* para `main`.
   Verificado: a app funciona servida a partir de uma subpasta (`/<repo>/`), com service worker e sem erros.
3. O endereço é `https://<utilizador>.github.io/<repo>/`. Funciona porque `base` é relativo.

## Depois de publicar

- Abre o endereço no **Safari** do iPhone com internet → espera uns segundos → Partilhar → *Adicionar ao ecrã principal*.
- Verifica o offline: ativa o modo avião e abre a app a partir do ícone.
- **Privacidade:** o site publicado só contém o código. Os teus dados nunca saem do telemóvel; não há analytics nem pedidos a terceiros (as fontes são empacotadas localmente).
- **Atualizações:** quando publicas uma nova versão, a app mostra "Nova versão disponível" e só atualiza quando tu tocas (e nunca durante um treino em curso). Os dados não são afetados.

## Cabeçalhos úteis (opcional)

Para Cloudflare Pages/Netlify, um ficheiro `public/_headers` pode forçar a revalidação do service worker:

```
/sw.js
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
```
