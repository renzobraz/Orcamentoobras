
import { GoogleGenAI } from "@google/genai";
import { ProjectData, CalculationResults } from "../types";

export const analyzeFeasibility = async (data: ProjectData, results: CalculationResults): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Verifica se é viabilidade rápida ou detalhada
  const isQuick = !!data.quickFeasibility;
  
  let prompt = "";

  if (isQuick && data.quickFeasibility) {
     const q = data.quickFeasibility;
     const built = q.landArea * q.constructionPotential;
     const vgv = built * (q.efficiency/100) * q.salePricePerSqm;
     const hardCost = built * q.constructionCostPerSqm;
     const profit = vgv - (q.askingPrice + hardCost + (vgv * q.softCostRate/100));
     const margin = (profit/vgv)*100;

     prompt = `
      Analise a VIABILIDADE RÁPIDA (Estudo de Massa) deste terreno:
      
      TERRENO:
      Área: ${q.landArea} m²
      Valor Pedido: R$ ${q.askingPrice.toLocaleString()}
      Potencial Construtivo: ${q.constructionPotential}x
      
      PRODUTO:
      Área Construída Est.: ${built.toLocaleString()} m²
      Eficiência: ${q.efficiency}%
      Venda: R$ ${q.salePricePerSqm.toLocaleString()}/m²
      Obra: R$ ${q.constructionCostPerSqm.toLocaleString()}/m²
      
      RESULTADOS PRELIMINARES:
      VGV Est.: R$ ${vgv.toLocaleString()}
      Lucro Líq.: R$ ${profit.toLocaleString()}
      Margem: ${margin.toFixed(1)}%
      
      Forneça um parecer executivo rápido (Markdown):
      1. O valor pedido pelo terreno faz sentido para a margem atual?
      2. Quais os riscos de se basear apenas nestes números preliminares?
      3. Sugestão de negociação (Swap/Permuta) baseada na margem.
     `;
  } else {
      // Prompt Detalhado (Legado)
      const unitsSummary = data.units?.map(u => 
        `- ${u.quantity}x ${u.name} (${u.area}m²) a R$${Math.round(u.pricePerSqm * u.area).toLocaleString()} un (R$${u.pricePerSqm}/m²)`
      ).join('\n') || "Não detalhado";

      const floorsSummary = `
        - Garagem: ${data.zoning?.garageFloors || 0}
        - Tipo: ${data.zoning?.standardFloors || 0}
        - Lazer/Comum: ${data.zoning?.leisureFloors || 0}
        - Cobertura: ${data.zoning?.penthouseFloors || 0}
      `;

      prompt = `
        Analise a viabilidade DETALHADA deste empreendimento:
        
        DADOS GERAIS:
        Nome: ${data.name}
        Área Construída: ${data.area} m²
        Potencial Construtivo (Permitida): ${results.permittedArea} m²
        
        TERRENO & ZONEAMENTO:
        Área Terreno: ${data.landArea} m²
        Altura Máxima: ${data.zoning?.maxHeight || '?'} m
        
        ESTRUTURA:
        ${floorsSummary}
        
        PRODUTO (MIX):
        ${unitsSummary}
        
        FINANCEIRO:
        Custo Terreno: R$ ${data.landValue.toLocaleString()}
        Custo Obra + Outros: R$ ${(results.totalCost - data.landValue).toLocaleString()}
        VGV Total: R$ ${results.vgv.toLocaleString()}
        Lucro Líquido: R$ ${results.profit.toLocaleString()}
        ROI: ${results.roi.toFixed(2)}%

        Forneça uma análise técnica (Markdown):
        1. Parecer sobre o Mix de Produtos.
        2. Análise da estrutura (altura vs pavimentos).
        3. Veredito final: Viável, Arriscado ou Inviável?
      `;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Erro na análise da IA:", error);
    return "Erro ao gerar análise. Verifique a chave de API ou tente novamente.";
  }
};
