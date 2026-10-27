# Lista de Mercado by Mascarelo

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

## Notificações

Dois avisos, que cada pessoa liga ou desliga em **Configurações**, em cada aparelho:
- **Nova lista criada:** avisa todos (inclusive quem criou) para entrarem e incluírem o que precisam. Tocar no aviso abre a lista.
- **Lista concluída:** avisa todos (inclusive quem concluiu). Tocar no aviso abre os itens da lista no histórico.

Mesmo esquema do Bolão F1:

- **Vigia** (`.github/workflows/vigia.yml`): fica ligado todos os dias das **7h às 23h** (Brasília) e avisa em cerca de 1 minuto.
- **Robô de reserva** (`.github/workflows/avisos.yml`): confere a cada 10 minutos, 24h por dia. Fora do horário do vigia, o aviso pode levar de 10 a 45 minutos (o agendador do GitHub atrasa).
- Os dois nunca mandam o mesmo aviso duas vezes. Tudo é gratuito, porque o repositório é público.

Cada pessoa ativa em **Configurações** (engrenagem na tela inicial), em cada aparelho. No iPhone, só funciona com o app instalado na tela de início (iOS 16.4 ou mais novo).

### Passo 9: chave das notificações web (VAPID)
1. Abra <https://console.firebase.google.com/project/lista-mercado-mascarelo/settings/cloudmessaging>.
2. Role até **Configuração da Web** → **Certificados push da Web** → **Gerar par de chaves**.
3. Copie a chave (um texto longo começando com `B`) e cole no `firebase-config.js`, em `VAPID_KEY`, no lugar de `COLE_AQUI`.

### Passo 10: chave da conta de serviço (para o robô enviar)
1. Abra <https://console.firebase.google.com/project/lista-mercado-mascarelo/settings/serviceaccounts/adminsdk>.
2. Clique em **Gerar nova chave privada** → **Gerar chave**. Um arquivo `.json` é baixado.
3. **Não** coloque esse arquivo no repositório: ele é uma senha.

### Passo 11: guardar a chave como segredo no GitHub
1. No repositório `lista-mercado-mascarelo`: **Settings → Secrets and variables → Actions → New repository secret**.
2. **Name:** `FIREBASE_SERVICE_ACCOUNT`
3. **Secret:** abra o `.json` baixado num editor de texto (Bloco de Notas, TextEdit), copie **tudo** e cole aqui. Clique em **Add secret**.
4. Pode apagar o `.json` do computador depois.

### Passo 12: subir os arquivos novos
1. **Add file → Upload files**: envie `index.html`, `app.js`, `styles.css`, `firebase-config.js`, `firestore.rules`, `README.md`, `firebase-messaging-sw.js` e a pasta `avisos`.
2. Os robôs ficam na pasta `.github/workflows`, que o computador costuma esconder (começa com ponto). O jeito mais garantido é criar cada um pelo GitHub: **Add file → Create new file**, digite o nome `.github/workflows/avisos.yml`, cole o conteúdo do arquivo de mesmo nome do zip e clique em **Commit changes**. Repita com `.github/workflows/vigia.yml`.
   - No Mac, para ver a pasta escondida: no Finder, aperte **Cmd + Shift + .** (ponto).

### Passo 13: publicar as regras novas
Cole de novo o conteúdo de `firestore.rules` em **Firestore Database → Regras → Publicar**. As regras novas permitem que cada aparelho registre as próprias notificações.

### Passo 14: ligar e testar
1. No GitHub, abra a aba **Actions**. Se aparecer um aviso para habilitar os workflows, clique para habilitar.
2. No celular: abra o app → engrenagem → ligue **Lista concluída** → **Permitir**. Toque em **Enviar notificação de teste** para ver se o aparelho mostra notificações.
3. Teste o envio de verdade pelo robô: **Actions → Enviar avisos da Lista de Mercado → Run workflow**, no campo de teste digite `todos` (ou o seu usuário, `thiago`) e clique em **Run workflow**. Em até 1 minuto a notificação chega.
4. Para ligar o vigia na hora, sem esperar o próximo horário: **Actions → Vigia dos avisos → Run workflow**. Rodando manualmente, ele fica ligado por 5h30 mesmo fora do horário.

Se o robô mostrar erro de permissão do Cloud Messaging, ative a API em <https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=lista-mercado-mascarelo> (**Ativar**).

---

## App Android (APK)

Opcional, para quem prefere instalar o app no Android. Mesmo esquema do Bolão F1:
- O GitHub gera o APK sozinho e publica na aba **Releases** do repositório.
- Cada APK novo tem número de versão maior e é assinado com a **mesma chave**. Por isso o Android instala **por cima**, sem desinstalar.
- O app avisa na tela inicial quando existe versão nova, com o botão **Atualizar agora**: o próprio app baixa a versão de **maior número** (pula as intermediárias) e abre o instalador do Android, sem passar pelo navegador. Na primeira vez, o Android pede para permitir que o app instale atualizações ("Permitir desta fonte").
- Em **Configurações → App Android** dá para ver a versão instalada e procurar atualização.
- O APK também recebe as notificações (notificação nativa do Android). Cada pessoa ativa em **Configurações** dentro do app.

Link para baixar (mande para os irmãos): <https://github.com/mascarelo/lista-mercado-mascarelo/releases/latest>

### Passo 16: guardar a chave de assinatura no GitHub
1. No repositório: **Settings → Secrets and variables → Actions → New repository secret**.
2. **Name:** `CHAVE_ASSINATURA`
3. **Secret:** abra o arquivo `CHAVE_ASSINATURA-lista-mercado.txt` (enviado separado, fora do zip), copie **tudo** e cole. Clique em **Add secret**.
4. Guarde esse arquivo num lugar seguro (Google Drive, por exemplo). Se a chave se perder, as próximas versões não vão atualizar por cima e todo mundo terá que desinstalar uma vez.

### Passo 16b: arquivo do Firebase para o app Android (notificações no APK)
1. Abra <https://console.firebase.google.com/project/lista-mercado-mascarelo/settings/general>.
2. Em **Seus apps**, clique em **Adicionar app** → ícone do **Android**.
3. **Nome do pacote do Android:** `com.mascarelo.listamercado` (exatamente assim). Apelido: `Lista Mercado Android`. Clique em **Registrar app**.
4. Clique em **Baixar google-services.json**. Pule os outros passos da tela (clique em Avançar até **Continuar no console**).
5. Envie o `google-services.json` para a raiz do repositório (Add file → Upload files). Ele não é senha: pode ficar no repositório.

### Passo 17: subir os arquivos do APK
1. **Add file → Upload files**: envie `package.json`, `capacitor.config.json`, `index.html`, `app.js`, `styles.css` e a pasta `android-res` (ícone das notificações).
2. **Add file → Create new file**, nome `.github/workflows/build-apk.yml`, cole o conteúdo do arquivo de mesmo nome do zip e clique em **Commit changes**.

### Passo 18: gerar e instalar
1. O APK começa a ser gerado sozinho a cada envio de arquivos do app. Para gerar na hora: **Actions → Gerar APK → Run workflow**. Leva uns 5 a 8 minutos.
2. Quando terminar (bolinha verde), abra a aba **Releases** (ou o link acima) e baixe `lista-de-mercado-by-mascarelo.apk` pelo celular.
3. Abra o arquivo e toque em **Instalar**. Na primeira vez o Android pede para permitir instalar apps de fontes desconhecidas pelo navegador: permita.
4. Nas próximas versões, é só baixar o novo APK e tocar em **Atualizar**. Não precisa desinstalar.

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
| `app.js` | Toda a lógica (telas, login, listas, usuários, configurações) |
| `styles.css` | Visual |
| `firebase-config.js` | Configuração do seu Firebase (você preenche) |
| `firestore.rules` | Regras de segurança (colar no Firebase) |
| `manifest.json`, `icons/` | Ícone do app (instalação pelo navegador) e imagem da tela de abertura |
| `firebase-messaging-sw.js` | Recebe as notificações com o app fechado |
| `avisos/enviar.js` | Robô que envia os avisos de lista concluída (e os testes) |
| `avisos/vigia.js` | Vigia que observa o banco e avisa em ~1 minuto |
| `.github/workflows/avisos.yml` | Agenda do robô (a cada 10 min) e botão de teste |
| `.github/workflows/vigia.yml` | Agenda do vigia (7h às 23h) |
| `.github/workflows/build-apk.yml` | Gera o APK e publica na aba Releases |
| `package.json`, `capacitor.config.json` | Configuração do app Android (APK) |
| `android-res/` | Ícone branco e cor das notificações do APK |
| `google-services.json` | Configuração do Firebase para o APK (você baixa no passo 16b) |
