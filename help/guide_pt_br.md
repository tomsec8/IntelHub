# Guia do Usuário - IntelHub 🕵️

Bem-vindo ao IntelHub. Esta extensão agrega ferramentas avançadas de inteligência de fontes abertas (OSINT) em uma interface única e conveniente, permitindo que pesquisadores e analistas realizem operações de forma rápida e eficiente.

---

## 🏠 Visão Geral - Interface Principal
No canto superior esquerdo da extensão, você encontrará o botão **Refresh** para atualizar a lista de ferramentas e as configurações.
Abaixo dele está uma **Barra de Pesquisa** (Search Bar) para localizar rapidamente categorias ou ferramentas específicas.

![Menu Principal - Topo](images/1.png)

No lado direito, há uma **Barra de Rolagem** para navegar entre diferentes categorias. No canto superior direito, há um botão para alternar o **Tema** visual.

![Menu Principal - Rolagem](images/2.png)

---

## ⭐ Favorites - Gerenciamento de Favoritos
Esta categoria centraliza as ferramentas que você marcou como "Favoritas" do grupo geral e permite adicionar ferramentas personalizadas e gerenciar categorias.

![Tela de Favoritos](images/3.png)

### Ações Principais:
**New Category:** Crie novas pastas/categorias para organizar suas ferramentas favoritas.

![Criar Nova Categoria](images/4.png)

**Add Custom Tool:** Adicione uma ferramenta externa (não presente na extensão) inserindo um Nome, URL e uma breve descrição. Você pode atribuir a ferramenta a uma categoria específica antes de salvar.

![Adicionar Ferramenta Personalizada](images/5.png)

**Export/Import:** Exporte sua lista de favoritos e configurações como um arquivo de backup, ou importe-os para transferir para outro usuário.

![Exportar e Importar](images/6.png)

**Gerenciamento Contínuo:**
É assim que a lista de ferramentas se parece após adicionar itens.
Para excluir uma categoria, clique no ícone da lixeira à direita. Para remover uma ferramenta dos favoritos, clique no ícone da Estrela (Unstar).

![Lista de Favoritos](images/7.png)

---

## 🛠️ OSINT Tools - Repositório de Ferramentas
Esta categoria contém o núcleo da extensão - uma lista abrangente de ferramentas de inteligência divididas por tópicos. A lista é sincronizada automaticamente com o repositório do GitHub e atualizada a cada 24 horas (ou mediante atualização manual).

Clicar em um tópico (Categoria) abrirá a lista de ferramentas pertencentes a ele:

![Categorias e Ferramentas](images/8.png)

* Clicar em uma ferramenta a abrirá em uma nova aba.
* Clicar no ícone da Estrela ao lado do nome de uma ferramenta a adicionará aos "Favoritos".
* Passar o mouse sobre uma ferramenta exibirá uma breve descrição (Tooltip) de sua função.

![Descrição da Ferramenta](images/9.png)

---

## 🖼️ Reverse Image Search - Busca Reversa de Imagens
Esta ferramenta permite realizar uma busca reversa de imagens em vários motores de busca simultaneamente.

![Menu Busca Reversa](images/10.png)

**Opções de Entrada:**
1.  **Upload:** Carregar um arquivo de imagem do seu computador.
2.  **Paste:** Colar uma imagem diretamente da Área de Transferência.

*Antes de pesquisar, marque as caixas de seleção dos motores de busca que deseja usar (Google, Yandex, Bing, TinEye, etc.). Sua seleção é salva para a próxima vez.*

---

## 📄 Metadata Analyzer - Analisador de Metadados
Uma ferramenta para extrair informações ocultas (Metadados/EXIF) de arquivos.

![Selecionar Tipo de Arquivo](images/11.png)

Selecione o tipo de arquivo desejado (Imagem, PDF ou documento Office) e carregue-o. O relatório de dados aparecerá imediatamente na parte inferior da janela (role para baixo para ver todos os detalhes).

![Resultados de Metadados](images/12.png)

---

## 🔍 Google Dorks - Construtor de Consultas
Uma interface para construir facilmente consultas de pesquisa avançadas do Google.

![Construtor de Dorks](images/13.png)

Insira os parâmetros desejados nos vários campos (Pesquisar dentro de um site específico, Tipo de arquivo, Palavras-chave em Título/URL/Texto).
Após construir a consulta, você pode clicar em **Search on Google** para execução imediata, ou ver a estrutura da consulta na caixa abaixo e copiá-la.

![Copiar Consulta](images/14.png)

---

## ✈️ Telegram Tools - Ferramentas do Telegram
Um conjunto de ferramentas para investigações no Telegram. Esta categoria permite pesquisas de números de telefone, coleta de detalhes de usuários/grupos e análise de exportações.

![Menu Ferramentas Telegram](images/15.png)

**User & Group Profiler:** Insira um nome de usuário (ou link) para realizar uma varredura profunda e exibir detalhes do usuário, foto de perfil, status e uma opção para obter o ID Numérico (**Fetch Numeric ID**).

![Resultados do Perfilador Telegram](images/16.png)

---

## 🌐 Site, Link & Archive - Análise de Sites
Uma coleção de ferramentas para analisar a página atual ou uma URL específica para reconhecimento inicial.

![Menu Análise de Site](images/17.png)

**Ferramentas Disponíveis:**
1.  **Website Fingerprint:** Captura a impressão digital do site (tecnologias, cookies) para verificações de autenticidade.
2.  **WHOIS & DNS:** Verifica a propriedade do domínio e registros DNS.
3.  **Technology Detection:** Identifica a pilha de tecnologia subjacente.
4.  **Subdomain Finder:** Localiza subdomínios.
5.  **Save Page Offline:** Salva a página atual como um arquivo HTML local para documentação.
6.  **Archive Search:** Pesquisa o histórico do site em vários arquivos da web.

---

## 🆔 Social ID Extractor
Projetado para extrair o **ID Numérico de Usuário** de perfis de redes sociais, ou para navegar até um perfil com base em um ID existente.

![Menu Extração de ID](images/18.png)

Navegue até a página de perfil (por exemplo, no Facebook) e clique no primeiro botão para extrair o ID.

![Resultado da Extração](images/19.png)

---

## 🔗 Link Analyzer - Análise de Links
Contém ferramentas para verificar a segurança e a origem de links.

![Menu Análise de Links](images/20.png)

* **Unshorten URL:** Decodifica links encurtados (como bit.ly) para revelar o endereço original.
* **Scan for Viruses:** Verifica o link no banco de dados do VirusTotal.

---

## 📝 Text Profiler - Perfilador de Texto
Verifica e extrai **Entidades** do texto. O sistema identifica e-mails, carteiras de criptomoedas, números de telefone, nomes de usuário e muito mais.

![Menu Perfilador de Texto](images/21.png)

Você pode analisar texto via **Paste** (Colar), upload de arquivo de texto externo ou verificando a **Página Atual** no navegador. Os resultados podem ser exportados para CSV.

---

## 📊 Investigation Graph - Gráfico de Investigação
Clicar nesta categoria abre o sistema de visualização.

![Botão do Gráfico](images/22.png)

Usando o gráfico, você pode criar um mapa de investigação, adicionar cartões de entidade e vinculá-los para visualizar claramente o quadro de inteligência.

![Interface do Gráfico](images/23.png)
