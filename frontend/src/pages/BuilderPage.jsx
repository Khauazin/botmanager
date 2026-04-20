import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ArrowLeft, Save, Play, MessageSquare, HelpCircle, GitBranch, Zap, Loader2, Bot as BotIcon, Key, SlidersHorizontal, Sparkles } from 'lucide-react';
import api from '../services/api';

const initialNodes = [];
const initialEdges = [];

export default function BuilderPage() {
  const { botId } = useParams();
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [flows, setFlows] = useState([]);
  const [activeFlowId, setActiveFlowId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [botConfig, setBotConfig] = useState({
    aiProvider: '',
    aiModel: '',
    aiApiKey: '',
    aiSystemPrompt: '',
    aiTemperature: 0.7
  });

  useEffect(() => {
    loadFlows();
  }, [botId]);

  const loadFlows = async () => {
    try {
      // Carrega o config do Bot
      const botResponse = await api.get(`/bots/${botId}`);
      if (botResponse.data) {
        setBotConfig({
          aiProvider: botResponse.data.aiProvider || '',
          aiModel: botResponse.data.aiModel || '',
          aiApiKey: botResponse.data.aiApiKey || '',
          aiSystemPrompt: botResponse.data.aiSystemPrompt || '',
          aiTemperature: botResponse.data.aiTemperature || 0.7
        });
      }

      // Carrega os fluxos do bot
      const response = await api.get(`/builder/flows/${botId}`);
      setFlows(response.data);
      if (response.data.length > 0) {
        setActiveFlowId(response.data[0].id);
        const flow = response.data[0];
        
        // Formata os nós do BD pro React Flow
        const formattedNodes = flow.nodes.map(n => ({
          id: n.id,
          type: 'default', // Para simplificar o MVP
          position: { x: n.positionX, y: n.positionY },
          data: { label: `${n.type}: ${n.data?.text || 'Sem texto'}`, dbType: n.type }
        }));
        
        // Formata as conexões
        const formattedEdges = flow.edges.map(e => ({
          id: e.id,
          source: e.sourceNodeId,
          target: e.targetNodeId,
          sourceHandle: e.sourceHandle
        }));

        setNodes(formattedNodes);
        setEdges(formattedEdges);
      } else {
        // Cria um fluxo default se não existir
        const res = await api.post('/builder/flows', {
          botId,
          name: 'Fluxo Principal',
          isActive: true,
          triggerType: 'DEFAULT'
        });
        setFlows([res.data]);
        setActiveFlowId(res.data.id);
      }
    } catch (error) {
      console.error('Erro ao carregar fluxos', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const handleSave = async () => {
    if (!activeFlowId) return;
    setIsSaving(true);
    try {
      // Salva o fluxo
      await api.post(`/builder/flows/${activeFlowId}/canvas`, {
        nodes,
        edges
      });
      // Salva a config de IA do bot
      await api.put(`/bots/${botId}`, botConfig);
      
      alert('Fluxo e Inteligência Artificial salvos com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar fluxo', error);
      alert('Erro ao salvar fluxo');
    } finally {
      setIsSaving(false);
    }
  };

  const addNode = (type) => {
    let dbType = 'MESSAGE';
    if (type === 'Pergunta') dbType = 'QUESTION';
    if (type === 'Condição') dbType = 'CONDITION';

    const newNode = {
      id: `node_${Date.now()}`,
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: { label: `Novo(a) ${type}`, dbType },
      // O tipo 'default' é nativo do React Flow. Em uma versão mais complexa teríamos custom nodes.
      type: 'default' 
    };
    setNodes((nds) => nds.concat(newNode));
  };

  if (isLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="h-full flex flex-col -m-8">
      {/* Header do Builder */}
      <div className="h-16 bg-black/40 border-b border-white/10 px-6 flex items-center justify-between backdrop-blur-xl z-10 relative">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-white">
            <Zap className="w-5 h-5 text-amber-400" />
            <h1 className="font-bold text-lg">Construtor de Fluxo</h1>
            <span className="text-gray-500 mx-2">|</span>
            <select 
              value={activeFlowId || ''} 
              onChange={(e) => setActiveFlowId(e.target.value)}
              className="bg-transparent border-none text-sm text-gray-300 outline-none cursor-pointer hover:text-white"
            >
              {flows.map(f => (
                <option key={f.id} value={f.id} className="bg-gray-900">{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm transition-colors border border-white/10">
            <Play className="w-4 h-4 text-emerald-400" /> Testar Bot
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Fluxo
          </button>
        </div>
      </div>

      {/* Área do Canvas com Toolbar lateral */}
      <div className="flex-1 flex relative">
        
        {/* Toolbar Lateral Esquerda (Blocos) */}
        <div className="w-64 bg-black/60 border-r border-white/10 p-4 flex flex-col gap-4 z-10 backdrop-blur-md">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Blocos de Ação</h3>
          
          <button onClick={() => addNode('Mensagem')} className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-blue-500/50 transition-all text-left group">
            <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30">
              <MessageSquare className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium mb-0.5">Mensagem</p>
              <p className="text-xs text-gray-500">Envia texto, imagem ou áudio</p>
            </div>
          </button>

          <button onClick={() => addNode('Pergunta')} className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-purple-500/50 transition-all text-left group">
            <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30">
              <HelpCircle className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium mb-0.5">Pergunta</p>
              <p className="text-xs text-gray-500">Espera a resposta do usuário</p>
            </div>
          </button>

          <button onClick={() => addNode('Condição')} className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-amber-500/50 transition-all text-left group">
            <div className="p-2 bg-amber-500/20 rounded-lg group-hover:bg-amber-500/30">
              <GitBranch className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium mb-0.5">Condição</p>
              <p className="text-xs text-gray-500">Se X for igual a Y</p>
            </div>
          </button>
        </div>

        {/* Canvas React Flow */}
        <div className="flex-1 h-full bg-[#0a0a0a]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            colorMode="dark"
            className="bg-[#0a0a0a]"
          >
            <Background color="#333" gap={16} size={1} />
            <Controls className="bg-black border border-white/10 fill-white" />
            <MiniMap 
              nodeColor={(n) => {
                return '#3b82f6';
              }}
              maskColor="rgba(0,0,0,0.7)"
              className="bg-black/80 border border-white/10 rounded-lg overflow-hidden"
            />
          </ReactFlow>
        </div>

        {/* Toolbar Lateral Direita (Configuração de IA) */}
        <div className="w-80 bg-black/60 border-l border-white/10 p-5 flex flex-col gap-6 z-10 backdrop-blur-md overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <BotIcon className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white uppercase tracking-wider">Cérebro da IA</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-1.5 block">Provedor</label>
              <select 
                value={botConfig.aiProvider}
                onChange={e => setBotConfig({...botConfig, aiProvider: e.target.value})}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Desativado (Fluxo Fixo)</option>
                <option value="OPENAI">OpenAI (ChatGPT)</option>
                <option value="ANTHROPIC">Anthropic (Claude)</option>
                <option value="GEMINI">Google (Gemini)</option>
                <option value="DEEPSEEK">DeepSeek</option>
              </select>
            </div>

            {botConfig.aiProvider && (
              <>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1.5 block">Modelo</label>
                  <input 
                    type="text" 
                    value={botConfig.aiModel}
                    onChange={e => setBotConfig({...botConfig, aiModel: e.target.value})}
                    placeholder="Ex: gpt-4o-mini" 
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1.5 flex items-center gap-1">
                    <Key className="w-3 h-3" /> API Key (Opcional)
                  </label>
                  <input 
                    type="password" 
                    value={botConfig.aiApiKey}
                    onChange={e => setBotConfig({...botConfig, aiApiKey: e.target.value})}
                    placeholder="Insira para usar chave própria..." 
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Deixe em branco para usar a global.</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> System Prompt (Personalidade)
                  </label>
                  <textarea 
                    value={botConfig.aiSystemPrompt}
                    onChange={e => setBotConfig({...botConfig, aiSystemPrompt: e.target.value})}
                    placeholder="Você é uma recepcionista de uma barbearia..." 
                    rows={6}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                      <SlidersHorizontal className="w-3 h-3" /> Temperatura
                    </label>
                    <span className="text-xs text-blue-400">{botConfig.aiTemperature}</span>
                  </div>
                  <input 
                    type="range" min="0" max="2" step="0.1" 
                    value={botConfig.aiTemperature}
                    onChange={e => setBotConfig({...botConfig, aiTemperature: parseFloat(e.target.value)})}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>Frio/Lógico</span>
                    <span>Criativo</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
