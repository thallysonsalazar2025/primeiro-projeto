# Fontes oficiais candidatas para a primeira carga externa

Este documento evita habilitar no registry uma URL que ainda não entrega o schema JSON esperado pelo pipeline. A regra permanece fail-closed: uma fonte só entra em `config/ingestion-sources*.json` com `enabled: true` depois de validar formato, proveniência, base de uso, licença/termos aplicáveis e adaptação para o contrato de importação.

## Critérios de prontidão

Uma fonte está pronta para ingestão quando:

1. a origem é oficial ou possui licença/termos compatíveis com reúso;
2. a URL de catálogo e a URL concreta do artefato são públicas e estáveis o suficiente para auditoria;
3. o formato é conhecido e o adaptador correspondente existe;
4. o manifesto bruto preserva a base de uso, licença/termos aplicáveis e a URL final validada após redirects;
5. o payload normalizado preserva concurso, banca, cargo/prova, ano, origem, licença e gabarito quando aplicável;
6. A4 valida fingerprint/deduplicação e persistência;
7. A9 cobre regressão e preservação do Simulado DATAPREV legado;
8. A10 valida URL, redirects, tamanho, integridade e política SSRF.

## Candidatas verificadas

| Prioridade | Fonte oficial | Conteúdo | Formato observado | Situação no pipeline |
| --- | --- | --- | --- | --- |
| P1 | Ministério da Gestão e da Inovação - CNU: `https://www.gov.br/gestao/pt-br/concursonacional/caderno-de-provas-e-gabaritos` | Cadernos de prova e gabaritos oficiais | Página catálogo HTML com links para PDF | **Bloqueada por descoberta + adaptador PDF**. Não cadastrar a landing page como fonte JSON nem tratá-la como documento bruto. |
| P1 | BNDES - Seleção Pública 2024: `https://www.bndes.gov.br/wps/portal/site/home/quem-somos/trabalhar-no-bndes/concursos-selecao-publica-2024` | Provas e gabaritos, incluindo Análise de Sistemas | Página catálogo HTML com links para PDF | **Bloqueada por descoberta + adaptador PDF**. Boa candidata de TI para validar o primeiro fluxo real após resolver o PDF concreto. |
| P2 | Dados Abertos Goiás - Concursos e Processos Seletivos: `https://dadosabertos.go.gov.br/dataset/concurso-e-selecao` | Dados administrativos de concursos/processos seletivos | Página catálogo com recursos CSV/ZIP | **Bloqueada por descoberta + adaptador tabular** e por mapeamento de domínio; não representa banco de questões por si só. |

## Contrato de documento bruto

O manifesto de proveniência deve acompanhar cada artefato concreto e conter, no mínimo:

- `sourceUrl`: página oficial/catalogadora usada como origem auditável;
- `documentUrl`: URL concreta solicitada para o PDF/CSV/ZIP selecionado após descoberta;
- `finalUrl`: URL final validada após redirects e que efetivamente forneceu os bytes armazenados;
- `documentType`: tipo efetivo do artefato (`pdf`, `csv`, `zip` etc.);
- `usageBasis`: categoria da base de uso (`official-publication`, `open-data`, `licensed` etc.);
- `license`: licença ou termos verificados para reúso, quando aplicável; não substituir este campo apenas por `usageBasis`;
- `termsUrl`: URL da licença/termos/política aplicável quando existir;
- `retrievedAt`: instante da obtenção;
- `sha256`: hash do conteúdo bruto obtido.

Para fontes classificadas como `open-data`, `license`/`termsUrl` devem preservar evidência suficiente para preencher o contrato normalizado posterior (`source.license`) e para auditoria. Se a licença ou os termos não puderem ser verificados, a fonte permanece bloqueada.

`finalUrl` deve ser persistida somente depois de todos os redirects terem passado pelo mesmo gate de segurança. O `sha256` corresponde exatamente aos bytes entregues por essa `finalUrl`, preservando a cadeia auditável `sourceUrl -> documentUrl -> finalUrl -> sha256`.

## Decisão de implementação

O próximo incremento de A7 deve separar descoberta de catálogo, documento oficial bruto e runner JSON. O runner atual continuará responsável apenas por payloads normalizados em `questions` ou `rankings`.

Ordem recomendada:

1. implementar estágio de descoberta para `sourceUrl` que extraia candidatos concretos (`documentUrl`) da página catálogo;
2. validar cada `documentUrl` descoberta com allowlist de tipo esperado, URL/redirects, política SSRF e limites antes de qualquer download;
3. selecionar explicitamente o artefato desejado (por exemplo, prova de Análise de Sistemas e respectivo gabarito) e construir `OfficialDocumentCandidate` com `sourceUrl`, `documentUrl`, `documentType`, `usageBasis`, `license` e `termsUrl`;
4. implementar download seguro reutilizando o gate HTTP/SSRF e limites já existentes e capturar a `finalUrl` validada;
5. armazenar o documento bruto e manifesto de proveniência com `sourceUrl`, `documentUrl`, `finalUrl`, `retrievedAt` e `sha256`, fora das filas `questions`/`rankings`;
6. adicionar adaptador PDF específico para prova/gabarito ou adaptador tabular conforme a fonte;
7. somente depois da normalização, publicar o JSON validado na fila existente;
8. executar primeira carga em uma prova oficial pequena e auditar o resultado antes de ampliar a cobertura.

A descoberta não deve seguir qualquer link arbitrário da landing page. Ela deve restringir protocolo, host/redirects, tipo de conteúdo e escopo esperado, e precisa manter a relação auditável entre catálogo, URL solicitada e endpoint final no manifesto.

## Não fazer

- Não marcar uma fonte PDF/CSV como `enabled: true` no registry JSON atual.
- Não baixar a landing page HTML como se fosse o documento oficial alvo.
- Não copiar bancos de questões de terceiros sem base de uso verificável.
- Não descartar licença ou termos específicos reduzindo-os apenas à categoria `usageBasis`.
- Não descartar a URL final após redirects do manifesto de proveniência.
- Não remover, reescrever ou migrar destrutivamente o dataset DATAPREV legado.
- Não contabilizar este mapeamento como primeira carga concluída; a issue A7 só avança nessa entrega quando houver código revisado e mergeado, e a primeira carga externa só deve ser considerada concluída após importação efetiva e validada.
