# Lista de Mercado - Mascarelo

App web para os irmãos manterem listas de compras compartilhadas. Funciona no celular e no computador, em tempo real.

- Cada pessoa tem um **usuário** (para entrar, ex.: `thiago`) e um **nome** (o que aparece no app, ex.: `Thiago`).
- Login com usuário e senha; troca obrigatória da senha no primeiro acesso.
- Só o administrador (Thiago) cria, edita, redefine senha e remove usuários.
- Várias listas abertas ao mesmo tempo; um toque marca o item como comprado.
- Item colocado por engano: toque nos **três pontinhos** ao lado dele para editar (nome e quantidade) ou apagar.
- Ao concluir uma lista, os itens pendentes ficam como **não comprados** e a lista vai para o histórico.
- Do histórico dá para criar uma nova lista com os mesmos itens.

Hospedagem: **GitHub Pages** (grátis). Login e dados: **Firebase**, no plano gratuito (Spark), sem cartão de crédito.

---

## Passo 1: criar o projeto no Firebase

1. Acesse <https://console.firebase.google.com> e clique em **Criar um projeto**.
2. Dê um nome (ex.: `lista-mercado`). O Google Analytics pode ser desativado. Clique em **Criar projeto**.

## Passo 2: ativar o login por usuário e senha

1. No menu à esquerda: **Criação → Authentication → Vamos começar**.
2. Na aba **Método de login**, escolha **E-mail/senha**, ative a primeira chave e clique em **Salvar**.

> O app transforma o nome de usuário em um e-mail interno (ex.: `thiago@listamercado.app`). Ninguém recebe e-mail; vocês só usam o nome de usuário.

## Passo 3: criar o banco de dados

1. No menu: **Criação → Firestore Database → Criar banco de dados**.
2. Local: **southamerica-east1 (São Paulo)**. Clique em **Avançar**.
3. Escolha **Iniciar no modo de produção** e clique em **Criar**.
4. Abra a aba **Regras**, apague tudo, cole o conteúdo do arquivo **`firestore.rules`** deste projeto e clique em **Publicar**.

## Passo 4: pegar a configuração do app

1. Clique na engrenagem ao lado de **Visão geral do projeto → Configurações do projeto**.
2. Em **Seus apps**, clique no ícone **`</>`** (Web). Dê um apelido (ex.: `Lista Mercado Web`), **não** marque Firebase Hosting e clique em **Registrar app**.
3. Vai aparecer um bloco `const firebaseConfig = { ... }`. Copie os valores para o arquivo **`firebase-config.js`**, trocando cada `COLE_AQUI`.

> É normal essa configuração ficar pública no GitHub: quem protege os dados são as regras do Passo 3.

## Passo 5: publicar no GitHub Pages

1. Em <https://github.com>, clique em **New repository**. Nome: `lista-mercado`. Deixe **Public** e clique em **Create repository**.
2. Na página do repositório, clique em **uploading an existing file**.
3. Arraste **todos os arquivos e a pasta `icons`** (index.html, app.js, styles.css, firebase-config.js, manifest.json, firestore.rules, README.md, icons/). Clique em **Commit changes**.
4. Vá em **Settings → Pages**. Em **Branch**, escolha **main** e a pasta **/ (root)**. Clique em **Save**.
5. Em 1–2 minutos o endereço aparece no topo da página: `https://SEU-USUARIO.github.io/lista-mercado/`.

## Passo 6: autorizar o endereço no Firebase

1. No Firebase: **Authentication → Configurações → Domínios autorizados → Adicionar domínio**.
2. Digite `SEU-USUARIO.github.io` (sem `https://` e sem `/lista-mercado`) e clique em **Adicionar**.

## Passo 7: primeiro acesso (administrador)

1. Abra o endereço do site. Na primeira vez aparece a tela **Configuração inicial**.
2. Crie o administrador: nome **Thiago**, usuário **thiago** e sua senha (já vêm preenchidos, só falta a senha). Essa tela nunca mais aparece.

> Faça isso logo depois de publicar: a primeira pessoa que abrir o site vira o administrador.

## Passo 8: cadastrar os irmãos

1. Na tela inicial, toque no ícone de **pessoas** (só você vê) → **Novo usuário**.
2. Preencha o **nome** (ex.: `Rafael`, aparece nos itens), o **usuário** (ex.: `rafael`, usado para entrar, sem espaços) e uma senha provisória.
3. Toque em **Copiar mensagem** e mande pelo WhatsApp. No primeiro acesso, cada um cria a própria senha.

Dica: no celular, abra o site e use **Instalar app** (ou **Adicionar à tela de início**) no menu do navegador para ele virar um ícone, como um app. Ao abrir, o ícone aparece por 1,5 segundo antes da tela inicial.

---

## Gerenciar usuários (só o administrador)

- **Editar:** muda o nome que aparece nos itens ou o nome de usuário.
- **Redefinir senha:** define uma nova senha provisória; a pessoa troca no próximo acesso.
- **Remover acesso:** a pessoa não entra mais. As listas e itens que ela criou continuam.

### Por que a redefinição de senha cria um "login novo"?
No plano gratuito do Firebase, o navegador não pode trocar a senha de outra pessoa. Por isso, ao redefinir, o app cria um login novo com o mesmo nome de usuário e desativa o antigo. Para a pessoa não muda nada. Os logins antigos ficam inativos em **Authentication → Usuários** e podem ser apagados lá se quiser, mas não fazem mal.

## Atualizar o app depois
Edite ou envie os arquivos novos pelo GitHub (**Add file → Upload files**). O site atualiza sozinho em 1–2 minutos.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | Página do app |
| `app.js` | Toda a lógica (telas, login, listas, usuários) |
| `styles.css` | Visual |
| `firebase-config.js` | Configuração do seu Firebase (você preenche) |
| `firestore.rules` | Regras de segurança (colar no Firebase) |
| `manifest.json`, `icons/` | Ícone do app (instalação pelo navegador) e imagem da tela de abertura |
