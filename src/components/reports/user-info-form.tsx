'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UserInfo } from '@/lib/export/types';

const STORAGE_KEY = 'cryptotax-user-info';

interface UserInfoFormProps {
  value: UserInfo;
  onChange: (info: UserInfo) => void;
}

export function UserInfoForm({ value, onChange }: UserInfoFormProps) {
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserInfo;
        onChange(parsed);
      }
    } catch {
      // Ignore parse errors
    }
    setLoaded(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage on change
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage full or unavailable
    }
  }, [value, loaded]);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Henkilotiedot / Personal Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="user-name">Nimi / Name</Label>
            <Input
              id="user-name"
              placeholder="Matti Meikalainen"
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-hetu">Henkilotunnus</Label>
            <Input
              id="user-hetu"
              placeholder="DDMMYY-XXXX"
              value={value.henkilotunnus}
              onChange={(e) =>
                onChange({ ...value, henkilotunnus: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Format: DDMMYY-XXXX or DDMMYY+XXXX
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
