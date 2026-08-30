# Concurso Intelligence

Nova plataforma de preparação para concursos públicos, criada como evolução do simulador DATAPREV 2024 existente no repositório.

## Objetivo

Transformar o simulador de prova única em uma plataforma multi-banca e multi-concurso, com:

- login e histórico persistente por usuário;
- catálogo de bancas, concursos, cargos, disciplinas, assuntos, provas e questões;
- montagem de sessões por banca + concurso + cargo + conteúdo;
- histórico completo de respostas, tempo e acerto;
- dashboard de desempenho;
- estimativa de classificação baseada em resultados oficiais;
- estimativa probabilística para concursos futuros usando provas anteriores da mesma banca/cargos semelhantes;
- ingestão contínua de novas provas e resultados com rastreabilidade de origem;
- deduplicação por fingerprint SHA-256;
- tratamento separado de ampla concorrência, negros, PCD e outras modalidades quando a fonte oficial fornecer essas listas.

## Arquitetura inicial

- Frontend/BFF: Next.js + TypeScript
- Banco: PostgreSQL
- ORM: Prisma
- Autenticação: credenciais com bcrypt + sessão JWT em cookie HTTP-only
- Ingestão: workers futuros para PDFs oficiais, páginas oficiais e datasets licenciados
- Busca: PostgreSQL full-text inicialmente; mecanismo dedicado apenas quando volume justificar

## Modelo de questão e proveniência

Cada questão preserva o contexto em que foi aplicada. O registro relaciona:

`banca -> órgão -> concurso -> cargo -> prova -> questão -> disciplina -> assunto`

Também são persistidos `sourceUrl`, página do documento, rótulo da fonte, hash do documento, data de coleta, licença quando conhecida e `contentFingerprint` para evitar duplicatas.

A regra é não copiar cegamente bancos de terceiros. O coletor deve priorizar fontes oficiais e datasets que permitam reutilização. Repositórios externos servem como referência técnica e/ou fonte somente quando a licença e os termos permitirem.

## Pipeline de atualização

1. Descobrir novos editais, provas, gabaritos e resultados em fontes configuradas.
2. Baixar ou registrar o documento-fonte e calcular SHA-256.
3. Extrair metadados: banca, órgão, concurso, cargo, data, modalidade e prova.
4. Extrair questões e alternativas quando a reutilização for permitida.
5. Normalizar disciplina/assunto usando taxonomia interna.
6. Calcular `contentFingerprint` e fazer UPSERT, nunca inserção cega.
7. Vincular `QuestionProvenance` para cada origem observada.
8. Importar resultados oficiais em `OfficialRankingRow`.
9. Marcar questões anuladas/outdated sem apagar o histórico.
10. Publicar relatório de ingestão com incluídos, atualizados, duplicados e rejeitados.

## Estimativa de classificação

### Concurso com resultado oficial

O algoritmo compara a nota simulada do usuário com a distribuição real de notas do mesmo cargo/modalidade. O retorno é uma faixa de posição, percentil, tamanho da amostra e nível de confiança.

### Concurso futuro

O sistema combina concursos históricos com pesos por:

- mesma banca;
- mesma família de cargo;
- sobreposição do conteúdo programático;
- tamanho da amostra;
- recência e qualidade da fonte (próxima evolução).

O dashboard deve sempre exibir intervalo e confiança. Nunca apresentar uma posição futura como garantia.

## Dashboard planejado

- total de questões e taxa de acerto;
- evolução diária/semanal;
- desempenho por banca, disciplina e assunto;
- tempo médio por questão;
- assuntos fortes/fracos;
- cobertura do edital;
- reincidência de erros;
- posição/percentil estimados;
- nota necessária para entrar em uma faixa de classificação;
- comparação entre desempenho atual e corte/histórico;
- histórico de logins e sessões.

## Segurança e privacidade

- senhas armazenadas apenas como hash bcrypt;
- sessão em cookie HTTP-only;
- não armazenar IP em claro; quando a auditoria de IP estiver habilitada, o endereço é lido somente do header de proxy explicitamente confiável, persistido como HMAC-SHA256 e o hash é removido após 90 dias, preservando o restante do histórico de login;
- dados públicos de resultados devem ser minimizados. Para o modelo estatístico não é necessário persistir nome completo/CPF de candidatos: `candidateKey` pode ser pseudonimizado durante a importação;
- manter URL e página da fonte para auditoria.

## Variáveis

Crie `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/concurso_intelligence
SESSION_SECRET=troque-por-um-segredo-longo-e-aleatorio
# Opcional. Use apenas quando o proxy de borda sobrescrever/sanitizar este header.
TRUSTED_IP_HEADER=x-forwarded-for
# Opcional. Se vazio ou ausente, SESSION_SECRET é usado para o HMAC do IP.
IP_HASH_SECRET=troque-por-outro-segredo-longo-e-aleatorio
```

`TRUSTED_IP_HEADER` aceita somente `x-forwarded-for` ou `x-real-ip`. Sem configuração válida, nenhum hash de IP é armazenado.

## Executar

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

## Próximas entregas

1. filtros reais banca/concurso/cargo/disciplina/assunto;
2. importador do simulado DATAPREV existente para o novo schema;
3. worker de ingestão de provas oficiais;
4. importador de resultados oficiais em PDF/CSV;
5. gráfico de evolução e matriz de desempenho por assunto;
6. cadastro de preparatório por edital;
7. estimativa de classificação integrada ao dashboard;
8. jobs agendados para detectar provas e resultados recém-publicados;
9. testes de autenticação, deduplicação, ingestão e ranking;
10. deploy com PostgreSQL gerenciado.
