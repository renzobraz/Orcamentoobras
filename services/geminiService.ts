
import { GoogleGenAI } from "@google/genai";
import { ProjectData, CalculationResults } from "../types";

export const analyzeFeasibility = async (data: ProjectData, results: CalculationResults) => {
  // Initialize Gemini API client with required named parameter using process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analise a viabilidade deste empreendimento imobiliário no Brasil:
    Nome: ${data.name}
    Tipo: ${data.type} (Padrão ${data.standard})
    Área: ${data.area} m²
    Custo do Terreno: R$ ${data.landValue.toLocaleString()}
    VGV Projetado: R$ ${results.vgv.toLocaleString()}
    Custo Total: R$ ${results.totalCost.toLocaleString()}
    Lucro Estimado: R$ ${results.profit.toLocaleString()}
    ROI: ${results.roi.toFixed(2)}%

    Por favor, forneça:
    1. Uma breve avaliação da lucratividade.
    2. Riscos potenciais (ex: custo de fundação alto para a área, margem apertada).
    3. Sugestões de melhoria (ex: otimização de m² ou aumento do VGV).
    4. Conclusão se o projeto parece viável.
    
    Responda em formato Markdown, seja profissional e técnico.
  `;

  try {
    // Generate content using the recommended model for basic text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Correctly access the .text property of GenerateContentResponse
    return response.text;
  } catch (error) {
    console.error("Erro na análise da IA:", error);
    return "Não foi possível gerar a análise da IA no momento. Verifique sua conexão ou tente novamente mais tarde.";
  }
};
