// Supabase Edge Function: ai-assist
// Executa no runtime Deno / Supabase Edge Functions.
// Chaves de API e segredos são lidos exclusivamente das variáveis de ambiente da função (GEMINI_API_KEY / OPENAI_API_KEY).
// O frontend NUNCA acessa nem armazena nenhuma chave de IA.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, payload } = await req.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('AI_API_KEY');

    if (!apiKey) {
      // Degradação elegante com resposta determinística estruturada caso a chave de IA não esteja configurada no Supabase
      if (action === 'break_task') {
        return new Response(
          JSON.stringify({
            subtasks: [
              { title: 'Revisar conceitos fundamentais e teoria', estimatedMin: 15 },
              { title: 'Resolver bloco de exercícios práticos', estimatedMin: 25 },
              { title: 'Anotar dúvidas e registrar pontos fracos', estimatedMin: 10 },
            ],
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'review_summary') {
        return new Response(
          JSON.stringify({
            summary: `Você manteve um ritmo constante com foco expressivo nas matérias principais. Continue equilibrando descanso e blocos de revisão para fixação de longo prazo.`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'plan_week') {
        return new Response(
          JSON.stringify({
            recommendation: `Distribua 3 blocos de foco de 50 min nos dias de maior energia e reserve o final de semana para revisão leve dos tópicos dominados.`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Se a chave existir, realiza a chamada ao modelo Gemini via endpoint REST seguro
    const prompt = action === 'break_task'
      ? `Você é um tutor de estudos e produtividade. Quebre a tarefa "${payload.title}" em 3 a 5 subtarefas práticas e objetivas. Responda em JSON: {"subtasks": [{"title": "...", "estimatedMin": 15}]}`
      : action === 'review_summary'
      ? `Gere um resumo acolhedor e encorajador em 2 parágrafos para a revisão periódica com base nestes números: Horas de foco: ${payload.focusHours}h, Tarefas feitas: ${payload.tasksDone}, Dias ativos: ${payload.activeDays}/7. Sem culpa, tom de disciplina sustentável.`
      : `Sugira um plano semanal em 3 tópicos para atingir a meta de estudos respeitando a capacidade de ${payload.capacityHours}h/semana.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await res.json();
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return new Response(
      JSON.stringify({ output: textOutput }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro ao processar IA' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
