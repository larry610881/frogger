import React, { useState, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { ProviderEntry, ProviderType } from '@frogger/shared';

interface ProviderAddSetupProps {
  onComplete: (entry: ProviderEntry | null) => void;
}

type Step = 'name' | 'label' | 'type' | 'baseURL' | 'envKey' | 'models' | 'defaultModel' | 'saving' | 'done';

const TYPES: ProviderType[] = ['openai-compatible', 'anthropic', 'openai'];

export function ProviderAddSetup({ onComplete }: ProviderAddSetupProps): React.ReactElement {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [typeIdx, setTypeIdx] = useState(0);
  const [baseURL, setBaseURL] = useState('');
  const [envKey, setEnvKey] = useState('');
  const [models, setModels] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [error, setError] = useState('');

  const nameRef = useRef('');
  const labelRef = useRef('');
  const baseURLRef = useRef('');
  const envKeyRef = useRef('');
  const modelsRef = useRef('');
  const defaultModelRef = useRef('');

  const selectedType = TYPES[typeIdx];

  useInput((ch, key) => {
    if (key.escape) {
      onComplete(null);
      return;
    }

    if (step === 'name') {
      if (key.return) {
        if (nameRef.current.trim()) setStep('label');
        return;
      }
      if (key.backspace || key.delete) {
        nameRef.current = nameRef.current.slice(0, -1);
        setName(nameRef.current);
        return;
      }
      if (ch && !key.ctrl && !key.meta && !key.tab) {
        nameRef.current += ch;
        setName(nameRef.current);
      }
      return;
    }

    if (step === 'label') {
      if (key.return) {
        if (labelRef.current.trim()) setStep('type');
        return;
      }
      if (key.backspace || key.delete) {
        labelRef.current = labelRef.current.slice(0, -1);
        setLabel(labelRef.current);
        return;
      }
      if (ch && !key.ctrl && !key.meta && !key.tab) {
        labelRef.current += ch;
        setLabel(labelRef.current);
      }
      return;
    }

    if (step === 'type') {
      if (key.upArrow) setTypeIdx(prev => Math.max(0, prev - 1));
      else if (key.downArrow) setTypeIdx(prev => Math.min(TYPES.length - 1, prev + 1));
      else if (key.return) {
        if (TYPES[typeIdx] === 'openai-compatible') {
          setStep('baseURL');
        } else {
          setStep('envKey');
        }
      }
      return;
    }

    if (step === 'baseURL') {
      if (key.return) {
        if (baseURLRef.current.trim()) setStep('envKey');
        return;
      }
      if (key.backspace || key.delete) {
        baseURLRef.current = baseURLRef.current.slice(0, -1);
        setBaseURL(baseURLRef.current);
        return;
      }
      if (ch && !key.ctrl && !key.meta && !key.tab) {
        baseURLRef.current += ch;
        setBaseURL(baseURLRef.current);
      }
      return;
    }

    if (step === 'envKey') {
      if (key.return) {
        if (envKeyRef.current.trim()) setStep('models');
        return;
      }
      if (key.backspace || key.delete) {
        envKeyRef.current = envKeyRef.current.slice(0, -1);
        setEnvKey(envKeyRef.current);
        return;
      }
      if (ch && !key.ctrl && !key.meta && !key.tab) {
        envKeyRef.current += ch;
        setEnvKey(envKeyRef.current);
      }
      return;
    }

    if (step === 'models') {
      if (key.return) {
        if (modelsRef.current.trim()) {
          const modelList = modelsRef.current.split(',').map(m => m.trim()).filter(Boolean);
          if (modelList.length > 0) {
            defaultModelRef.current = modelList[0];
            setDefaultModel(modelList[0]);
            setStep('defaultModel');
          }
        }
        return;
      }
      if (key.backspace || key.delete) {
        modelsRef.current = modelsRef.current.slice(0, -1);
        setModels(modelsRef.current);
        return;
      }
      if (ch && !key.ctrl && !key.meta && !key.tab) {
        modelsRef.current += ch;
        setModels(modelsRef.current);
      }
      return;
    }

    if (step === 'defaultModel') {
      if (key.return) {
        setStep('saving');
        doSave();
        return;
      }
      if (key.backspace || key.delete) {
        defaultModelRef.current = defaultModelRef.current.slice(0, -1);
        setDefaultModel(defaultModelRef.current);
        return;
      }
      if (ch && !key.ctrl && !key.meta && !key.tab) {
        defaultModelRef.current += ch;
        setDefaultModel(defaultModelRef.current);
      }
      return;
    }

    if (step === 'done') {
      if (key.return) {
        exit();
      }
    }
  });

  async function doSave() {
    try {
      const { addProvider } = await import('@frogger/core');
      const { DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_OUTPUT_TOKENS } = await import('@frogger/shared');
      const modelNames = modelsRef.current.split(',').map(m => m.trim()).filter(Boolean);
      const modelList = modelNames.map(name => ({
        name,
        contextWindow: DEFAULT_CONTEXT_WINDOW,
        maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
      }));
      const entry: ProviderEntry = {
        name: nameRef.current.trim(),
        label: labelRef.current.trim(),
        type: selectedType,
        ...(selectedType === 'openai-compatible' ? { baseURL: baseURLRef.current.trim() } : {}),
        envKey: envKeyRef.current.trim(),
        models: modelList,
        defaultModel: defaultModelRef.current.trim() || modelNames[0],
      };
      await addProvider(entry);
      onComplete(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('done');
    }
  }

  const textInput = (label: string, value: string, hint?: string) => (
    <Box flexDirection="column">
      <Text bold>{label}</Text>
      {hint && <Text dimColor>{hint}</Text>}
      <Box>
        <Text color="yellow">{'>  '}</Text>
        <Text>{value}</Text>
        <Text color="gray">{'\u2588'}</Text>
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="green" bold>Add Provider</Text>
      <Text> </Text>

      {step === 'name' && textInput('Provider name (unique identifier):', name, 'e.g. groq, ollama, together')}
      {step === 'label' && textInput('Display label:', label, 'e.g. Groq Cloud, Ollama (Local)')}

      {step === 'type' && (
        <Box flexDirection="column">
          <Text bold>Provider type:</Text>
          <Text> </Text>
          {TYPES.map((t, i) => (
            <Text key={t}>
              <Text color={i === typeIdx ? 'green' : 'white'}>
                {i === typeIdx ? '> ' : '  '}
              </Text>
              <Text bold={i === typeIdx}>{t}</Text>
            </Text>
          ))}
        </Box>
      )}

      {step === 'baseURL' && textInput('Base URL:', baseURL, 'e.g. https://api.groq.com/openai/v1')}
      {step === 'envKey' && textInput('Environment variable for API key:', envKey, 'e.g. GROQ_API_KEY')}
      {step === 'models' && textInput('Available models (comma-separated):', models, 'e.g. llama-3.3-70b,mixtral-8x7b')}
      {step === 'defaultModel' && textInput('Default model:', defaultModel)}

      {step === 'saving' && <Text color="cyan">Saving provider...</Text>}

      {step === 'done' && error && (
        <Box flexDirection="column">
          <Text color="red" bold>Failed to add provider</Text>
          <Text color="red">{error}</Text>
          <Text dimColor>Press Enter to exit.</Text>
        </Box>
      )}
    </Box>
  );
}
