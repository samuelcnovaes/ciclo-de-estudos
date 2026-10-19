# Administração unificada — ativada

Ativada em 18/10/2026 após autorização explícita do proprietário. Contas existentes foram preservadas. A execução integral em uma transação com ROLLBACK passou: contas existentes preservadas, novos cadastros comuns, proteção do último administrador, revogação de leitura/gravação e isolamento dos estudos.

Componentes da ativação:

1. Aplicar `platform-access-schema.sql` atomicamente. A carga inicial mantém todas as contas atuais ativas no Planejamento e preserva como administradores os administradores existentes do Desempenho. Contas novas recebem acesso comum ao Planejamento; o Desempenho continua dependendo de autorização.
2. Implantar `functions/platform-create-user` com `verify_jwt = true`. A função confirma a sessão com `getUser`, consulta o papel no banco e só então usa a credencial de servidor para criar a conta. Nome, e-mail e senha inicial são exigidos. Nenhuma senha é retornada ou registrada em auditoria. Nenhum convite é enviado. A conta criada fica pronta para entrar com a senha inicial informada pelo administrador.
3. Carregar `platform-admin.css` e `platform-admin.js` nas duas páginas e executar `PlatformAdmin.attach(client, elementoDoMenu)` após a autenticação. O módulo verifica a permissão de administrador no servidor. O painel lista todas as contas e permite criar conta, conceder/revogar cada aplicativo separadamente e conceder/retirar administração.
4. Integrar `platform-cycle-access.js` ao `CicloCloud.prepare`: executar `await PlatformCycleAccess.check(client,session.user)` antes de carregar estudos; ao negar acesso, mostrar a mensagem sem inicializar o app. Usar a mesma verificação antes das atualizações periódicas. Manter a sessão para que um usuário com acesso somente ao Desempenho continue usando o relatório.
5. Revalidar como administrador, membro, revogado e conta nova. Confirmar a proteção do último administrador, o registro das ações e a ausência de acesso aos estudos de outras contas.

A revogação bloqueia novas consultas e gravações no servidor; não apaga os estudos nem arquivos e cópias que já tenham sido baixados. A reversão da ativação deve preservar as tabelas e auditoria e restaurar as políticas anteriores somente por decisão administrativa explícita.
