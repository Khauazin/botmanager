import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import { Settings, Save, Loader2, MessageSquare, Clock, Type, Hash, ToggleLeft, ToggleRight, CheckCircle } from 'lucide-react';
import api from '../services/api';

export default function BotSettingsPage() {
  const { user } = useAuthStore();
  const [bots, setBots] = useState([]);
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [variables, setVariables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  useEffect(() => {
    loadBots();
  }, []);

  useEffect(() => {
    if (selectedBotId) {
      loadVariables(selectedBotId);
    }
  }, [selectedBotId]);

  const loadBots = async () => {
    try {
      const response = await api.get('/bots');
      setBots(response.data);
      if (response.data.length > 0) {
        setSelectedBotId(response.data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar bots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadVariables = async (botId) => {
    try {
      const response = await api.get(`/bot-variables/${botId}`);
      setVariables(response.data);
    } catch (error) {
      console.error('Erro ao carregar variáveis:', error);
    }
  };

  const handleSaveVariable = async (variable) => {
    setSavingId(variable.id);
    try {
      await api.put(`/bot-variables/${variable.id}`, {
        value: variable.value
      });
      setSavedId(variable.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (error) {
      console.error('Erro ao salvar variável:', error);
      alert('Erro ao salvar configuração');
    } finally {
      setSavingId(null);
    }
  };

  const handleChangeValue = (id, newValue) => {
    setVariables(prev => prev.map(v => 
      v.id === id ? { ...v, value: newValue } : v
    ));
  };

  const getVarIcon = (type) => {
    switch(type) {
      case 'TEXT': return <Type className="w-4 h-4 text-blue-400" />;
      case 'NUMBER': return <Hash className="w-4 h-4 text-purple-400" />;
      case 'BOOLEAN': return <ToggleLeft className="w-4 h-4 text-amber-400" />;
      default: return <Type className="w-4 h-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Settings className="w-8 h-8 text-gray-400" />
          Configurações do Bot
        </h1>
        <p className="text-gray-400 mt-2">
          Personalize as mensagens e configurações do seu chatbot. Alterações avançadas no fluxo devem ser solicitadas ao suporte.
        </p>
      </div>

      {/* Seletor de Bot */}
      {bots.length > 1 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <label className="text-sm font-medium text-gray-400 mb-2 block">Selecione o Bot</label>
          <div className="flex flex-wrap gap-2">
            {bots.map(bot => (
              <button
                key={bot.id}
                onClick={() => setSelectedBotId(bot.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                  selectedBotId === bot.id 
                    ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' 
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                {bot.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Variáveis */}
      {variables.length === 0 ? (
        <div className="bg-white/5 border border-white/10 border-dashed rounded-3xl p-12 text-center">
          <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Nenhuma configuração disponível</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            O administrador ainda não liberou configurações editáveis para este bot. Entre em contato com o suporte se precisar alterar alguma mensagem.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {variables.map(variable => (
            <div 
              key={variable.id}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all group"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                    {getVarIcon(variable.type)}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{variable.description || variable.key}</h3>
                    <p className="text-xs text-gray-500 font-mono">{variable.key}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => handleSaveVariable(variable)}
                  disabled={savingId === variable.id}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    savedId === variable.id 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 hover:text-white'
                  }`}
                >
                  {savingId === variable.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : savedId === variable.id ? (
                    <><CheckCircle className="w-4 h-4" /> Salvo!</>
                  ) : (
                    <><Save className="w-4 h-4" /> Salvar</>
                  )}
                </button>
              </div>

              {variable.type === 'BOOLEAN' ? (
                <button
                  onClick={() => handleChangeValue(variable.id, variable.value === 'true' ? 'false' : 'true')}
                  className="flex items-center gap-3 text-sm"
                >
                  {variable.value === 'true' ? (
                    <ToggleRight className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-500" />
                  )}
                  <span className={variable.value === 'true' ? 'text-emerald-400' : 'text-gray-500'}>
                    {variable.value === 'true' ? 'Ativado' : 'Desativado'}
                  </span>
                </button>
              ) : variable.type === 'NUMBER' ? (
                <input
                  type="number"
                  value={variable.value}
                  onChange={(e) => handleChangeValue(variable.id, e.target.value)}
                  className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                />
              ) : (
                <textarea
                  value={variable.value}
                  onChange={(e) => handleChangeValue(variable.id, e.target.value)}
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  placeholder="Digite o valor..."
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
