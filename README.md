# Ciclo de Estudos

Aplicativo estático com login e sincronização pelo Supabase. Cada conta acessa somente seus próprios estudos.

## Publicar no GitHub Pages

1. Abra Settings → Pages neste repositório.
2. Em Build and deployment, selecione Deploy from a branch.
3. Selecione main e /(root), e salve.
4. Aguarde o GitHub confirmar a publicação.

Endereço previsto: https://samuelcnovaes.github.io/ciclo-de-estudos/
Esse endereço só estará ativo depois de habilitar o Pages.

## Configurar o Supabase

Projeto: hksxuvnevztwnyfbuftx.
A tabela ciclo_study_state já foi criada, com segurança em nível de linha e controle de versão.
O arquivo supabase/schema.sql é uma referência; não o execute novamente no banco existente.

Em Authentication → URL Configuration:

- Site URL: https://samuelcnovaes.github.io/ciclo-de-estudos/
- Redirect URLs: https://samuelcnovaes.github.io/ciclo-de-estudos/
- Se continuar usando o site anterior, inclua também https://ciclo-de-estudos.grandbead8.chatgpt.site/

O provedor Email está habilitado com confirmação de e-mail. Configure o envio de e-mails adequado
antes de liberar cadastro para outros usuários. Não desative a confirmação para contornar um erro de envio.
A configuração de retorno e a entrega de e-mail precisam ser verificadas no painel; não foram alteradas pela integração do banco.

## Transferir os estudos existentes

1. Exporte o backup no site anterior, usando o navegador onde estão seus registros.
2. Abra o novo site e crie/entre na conta da nuvem.
3. Abra Dados e backup e importe o arquivo.
4. Confira os totais e aguarde o indicador Salvo na nuvem.
5. Entre na mesma conta em outro dispositivo e confira os dados.

Não há registros pessoais ou backups no repositório público. Nenhuma chave secreta foi incluída.
A chave pública do Supabase é parte da configuração do cliente; o isolamento é aplicado no banco.

## Arquivos

- index.html: interface e lógica do aplicativo.
- cloud-ui.js: login, recuperação de senha e sincronização.
- supabase.js: SDK com versão fixa, empacotado localmente.
- src/snapshot-sync.js: fila de snapshots com proteção contra conflitos.
- src/cloud-entry.js: entrada para recompilar o SDK.
- sw.js: notificações enquanto o aplicativo está aberto.
- supabase/schema.sql: esquema de referência.

## Desenvolvimento e testes

```sh
npm ci --ignore-scripts
npm run build:cloud
npm test
```

O site já inclui o SDK compilado: o Pages não precisa executar um build.
Sete testes verificam exigência de login, conta vazia, caminhos relativos, link em outra aba,
fila de salvamento, recuperação após falha e bloqueio de conflitos.
O isolamento também foi testado no banco com duas contas temporárias dentro de uma transação revertida.

## Limites atuais

- Conflitos preservam o rascunho local e bloqueiam a sobrescrita; não há mesclagem automática.
- Checkpoints do cronômetro são enviados em intervalos de 30 segundos; confira o indicador antes de fechar.
- Notificações com o site fechado e e-mails de revisão exigem uma integração adicional.
- Login, confirmação de e-mail e aparência ainda precisam de conferência no endereço publicado.
