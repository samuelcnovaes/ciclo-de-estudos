# TEC + Planejamento

Instale `tec-planejamento.user.js` no Tampermonkey, substituindo a versão anterior do mesmo script. As funções originais de metas, contagem e Aprovado permanecem disponíveis. A nova integração de sessões funciona no TEC e no Planejamento, no mesmo navegador e perfil, com o mesmo script habilitado nos dois sites.

1. No [Planejamento](https://samuelcnovaes.github.io/ciclo-de-estudos/), entre na sua conta, selecione a prova e o planejamento desejados. Clique em **TEC** no cabeçalho e ative a integração.
2. No TEC, use **Conectar ao Planejamento** no painel azul. Mantenha a aba do Planejamento aberta. Clique em **Iniciar sessão**, ou em **Vincular cronômetro atual** se já houver um cronômetro.
3. Resolva questões de quaisquer matérias e tópicos. O painel acompanha o cronômetro do Planejamento e permite pausar ou continuar.
4. Clique em **Conferir e salvar**. Na aba do Planejamento, confira matéria, tópico, acertos, erros, tempo e etapa correspondente. Clique em **Salvar registros no Planejamento** para gravar.

## Registro e etapas

Cada combinação de matéria e tópico gera um registro. O tempo por tópico é **estimado** pelos intervalos entre respostas detectadas e pode ser ajustado na conferência. A soma deve ser igual ao tempo total do cronômetro. O script não mede com precisão o tempo individual de cada questão.

Uma etapa é selecionada automaticamente apenas quando existe uma correspondência única de tópico ou uma única etapa genérica de questões da matéria. Confira essa seleção antes de salvar. Sem etapa selecionada, o registro entra somente no histórico. Matérias desconhecidas podem ser associadas a uma existente ou cadastradas no salvamento. Respostas sem identificação de assunto ficam sinalizadas para correção na conferência.

A mesma sessão não é importada novamente ao repetir o comando de salvar. A contagem original continua usando a regra anterior de uma resposta por questão por dia. Alterações de prova, conta ou planejamento bloqueiam a importação até voltar ao contexto original.

## Interrupções

Fechar a conferência mantém os resultados e o cronômetro pausado. Se a conexão cair, mantenha o painel aberto e reabra o Planejamento no mesmo contexto. A sessão é guardada no Tampermonkey. Se o cronômetro tiver sido descartado no Planejamento, o botão **Recuperar sessão guardada** permite restaurar os últimos resultados e tempo sincronizados, com o cronômetro pausado.

Não desinstale o script nem limpe seus dados antes de salvar sessões pendentes. O Planejamento é a referência do tempo; após fechar sua aba, não há garantia de sincronização até reabri-la. Nenhuma senha ou token de autenticação é enviado ao TEC. A integração com Aprovado mantém as funções originais, sem importar sessões para o Planejamento.

## Validação

Testes automatizados cobrem agrupamento, arredondamento de tempo, importação, seleção de etapas, contexto da conta, proteção contra duplicação e transporte entre duas abas simuladas. O fluxo completo ainda precisa ser conferido no TEC autenticado com Tampermonkey instalado; mudanças no HTML do TEC podem afetar a detecção original de respostas.
