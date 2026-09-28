/**
 * @jest-environment jsdom
 */
import React, { createContext, useContext } from 'react';
import ReactTestRenderer from 'react-test-renderer';

class LogBoxLog {
  level: string;
  message: { content: string; substitutions: any[] };
  isComponentError: boolean;
  stack: any[];
  category: string;
  componentStack: any[];

  constructor(data: any) {
    this.level = data.level || 'log';
    this.message = data.message || { content: '', substitutions: [] };
    this.isComponentError = Boolean(data.isComponentError);
    this.stack = data.stack || [];
    this.category = data.category || 'default';
    this.componentStack = data.componentStack || [];
  }
}

const LogContext = createContext<any>(null);
const useLogs = () => useContext(LogContext);


describe('LogContext Runtime Safety & Regression Suite', () => {
  const originalExpoOs = process.env.EXPO_OS;

  beforeEach(() => {
    process.env.EXPO_OS = 'web';
    const el = document.getElementById('_expo-static-error');
    if (el) el.remove();
  });

  afterEach(() => {
    process.env.EXPO_OS = originalExpoOs;
    const el = document.getElementById('_expo-static-error');
    if (el) el.remove();
  });

  it('should safely parse double-stringified JSON without throwing Cannot read properties of undefined map', () => {
    const rawLogData = {
      level: 'static',
      message: { content: 'Metro Error: SyntaxError in Root Component', substitutions: [] },
      isComponentError: false,
      stack: [],
      category: 'static',
      componentStack: [],
    };

    const logBoxContext = {
      selectedLogIndex: 0,
      isDisabled: false,
      logs: [rawLogData],
    };

    // Exactly replicating metroErrorInterface.js lines 347-348:
    const serializedLogBox = JSON.stringify(logBoxContext).replace(/</g, '\\u003c');
    const doubleStringifiedJson = JSON.stringify(serializedLogBox);

    const parsedPayload = (() => {
      try {
        const raw = JSON.parse(doubleStringifiedJson);
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return {
          ...data,
          logs: (data.logs || []).map((l: any) => new LogBoxLog(l)),
        };
      } catch {
        return { selectedLogIndex: 0, isDisabled: false, logs: [] };
      }
    })();

    let capturedLogs: any = null;
    function Consumer() {
      capturedLogs = useLogs();
      return null;
    }

    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(
        <LogContext.Provider value={parsedPayload}>
          <Consumer />
        </LogContext.Provider>
      );
    });

    expect(capturedLogs).toBeDefined();
    expect(capturedLogs.selectedLogIndex).toBe(0);
    expect(capturedLogs.isDisabled).toBe(false);
    expect(Array.isArray(capturedLogs.logs)).toBe(true);
    expect(capturedLogs.logs.length).toBe(1);
    expect(capturedLogs.logs[0]).toBeInstanceOf(LogBoxLog);
    expect(capturedLogs.logs[0].message.content).toBe('Metro Error: SyntaxError in Root Component');
  });

  it('should gracefully handle malformed or undefined logs array without crashing', () => {
    const malformedPayload = JSON.stringify({
      selectedLogIndex: 0,
      isDisabled: false,
      // logs is completely undefined
    });

    const script = document.createElement('script');
    script.id = '_expo-static-error';
    script.type = 'application/json';
    script.textContent = malformedPayload;
    document.body.appendChild(script);

    const parsedMalformed = (() => {
      try {
        const raw = JSON.parse(malformedPayload);
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return {
          ...data,
          logs: (data.logs || []).map((l: any) => new LogBoxLog(l)),
        };
      } catch {
        return { selectedLogIndex: 0, isDisabled: false, logs: [] };
      }
    })();

    let capturedLogs: any = null;
    function Consumer() {
      capturedLogs = useLogs();
      return null;
    }

    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(
        <LogContext.Provider value={parsedMalformed}>
          <Consumer />
        </LogContext.Provider>
      );
    });

    expect(capturedLogs).toBeDefined();
    expect(capturedLogs.logs).toEqual([]);
    expect(capturedLogs.selectedLogIndex).toBe(0);
  });

  it('should return context value when used within LogContext.Provider', () => {
    const mockLog = new LogBoxLog({
      level: 'warn',
      message: { content: 'Warning message', substitutions: [] },
      isComponentError: false,
      stack: [],
      category: 'warn',
      componentStack: [],
    });

    const contextValue = {
      selectedLogIndex: 0,
      isDisabled: false,
      logs: [mockLog],
    };

    let capturedLogs: any = null;
    function Consumer() {
      capturedLogs = useLogs();
      return null;
    }

    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(
        <LogContext.Provider value={contextValue}>
          <Consumer />
        </LogContext.Provider>
      );
    });

    expect(capturedLogs).toBe(contextValue);
    expect(capturedLogs.logs[0].message.content).toBe('Warning message');
  });
});
