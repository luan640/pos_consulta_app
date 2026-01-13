DEFAULT_GROUP_TEMPLATES = [
    {
        "nome": "Pos-consulta - Reeducacao 30 dias",
        "descricao": "Sequencia de acompanhamento pos-consulta para 30 dias",
        "regras": [
            ("Boas-vindas e plano inicial", 1, "Mensagem de boas-vindas e reforco do plano inicial."),
            ("Organizacao de rotina", 3, "Dicas de organizacao das refeicoes e rotina."),
            ("Check-in de adesao", 7, "Pergunta sobre dificuldades e reforco motivacional."),
            ("Educacao nutricional", 14, "Material educativo para manter consistencia."),
            ("Ajustes e reforco", 21, "Reforco de habitos e ajustes finos."),
            ("Encerramento e retorno", 28, "Encerramento do ciclo e convite para retorno."),
        ],
    },
    {
        "nome": "Ganho de massa - 30 dias",
        "descricao": "Sequencia de acompanhamento para ganho de massa",
        "regras": [
            ("Boas-vindas e metas", 1, "Mensagem inicial com metas de ganho de massa e expectativas."),
            ("Planejamento alimentar", 3, "Orientacoes sobre distribuicao de calorias e horarios."),
            ("Check-in de execucao", 7, "Verificar adesao ao plano e dificuldades."),
            ("Ajuste de macros", 14, "Reforco de proteinas e ajustes conforme evolucao."),
            ("Treino e recuperacao", 21, "Dicas de treino, descanso e recuperacao."),
            ("Reavaliacao e retorno", 28, "Encerramento do ciclo e convite para reavaliacao."),
        ],
    },
    {
        "nome": "Retorno - 14 dias",
        "descricao": "Sequencia curta de acompanhamento para retorno",
        "regras": [
            ("Boas-vindas ao retorno", 1, "Mensagem inicial e alinhamento do foco do retorno."),
            ("Check-in rapido", 3, "Pergunta objetiva sobre evolucao e dificuldades."),
            ("Ajustes pontuais", 7, "Sugestoes de ajuste com base no feedback."),
            ("Encerramento e proxima etapa", 14, "Resumo do retorno e convite para nova consulta."),
        ],
    },
    {
        "nome": "Acompanhamento mensal - 7 dias",
        "descricao": "Apenas entrar em contato com o paciente para manter contato",
        "regras": [
            ("Contato", 7, "Manter contato."),
        ],
    },

]
