'use client';

import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { Button, Input } from '@/components/ui';
import { SKILLS, HYDERABAD_AREAS, VALIDATION } from '@/constants';
import type { Skill } from '@/types';

export interface WorkerFormData {
  name: string;
  skills: Skill[];
  experience: number;
  hourlyRate: number;
  serviceAreas: string[];
  description: string;
  aadhaarPhoto: File;
  profilePhoto?: File;
}

interface WorkerRegisterFormProps {
  onSubmit: (data: WorkerFormData) => Promise<void> | void;
  submitting: boolean;
  serverError?: string | null;
}

export function WorkerRegisterForm({
  onSubmit,
  submitting,
  serverError,
}: WorkerRegisterFormProps) {
  const [name, setName] = useState('');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [experience, setExperience] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [aadhaarPhoto, setAadhaarPhoto] = useState<File | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function toggleSkill(id: Skill) {
    setSkills((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function toggleArea(id: string) {
    setAreas((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (name.trim().length < VALIDATION.NAME_MIN_LENGTH) {
      next.name = 'Naam kam se kam 2 letter ka hona chahiye.';
    }

    if (skills.length === 0) next.skills = 'Kam se kam ek kaam (skill) chuno.';

    const exp = Number(experience);
    if (
      !Number.isFinite(exp) ||
      exp < VALIDATION.MIN_EXPERIENCE ||
      exp > VALIDATION.MAX_EXPERIENCE
    ) {
      next.experience = `Experience ${VALIDATION.MIN_EXPERIENCE}-${VALIDATION.MAX_EXPERIENCE} saal ke beech daalo.`;
    }

    const rate = Number(hourlyRate);
    if (!Number.isFinite(rate) || rate < VALIDATION.MIN_RATE || rate > VALIDATION.MAX_RATE) {
      next.hourlyRate = `Rate Rs.${VALIDATION.MIN_RATE} se Rs.${VALIDATION.MAX_RATE} ke beech daalo.`;
    }

    if (areas.length === 0) next.areas = 'Kam se kam ek area chuno jahan kaam karoge.';
    if (!aadhaarPhoto) next.aadhaarPhoto = 'Verification ke liye Aadhaar ki photo upload karo.';
    if (aadhaarPhoto && aadhaarPhoto.size > 5 * 1024 * 1024) {
      next.aadhaarPhoto = 'Aadhaar photo 5 MB se chhoti honi chahiye.';
    }
    if (profilePhoto && profilePhoto.size > 5 * 1024 * 1024) {
      next.profilePhoto = 'Profile photo 5 MB se chhoti honi chahiye.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    await onSubmit({
      name: name.trim(),
      skills,
      experience: Number(experience),
      hourlyRate: Number(hourlyRate),
      serviceAreas: areas,
      description: description.trim(),
      aadhaarPhoto: aadhaarPhoto!,
      profilePhoto: profilePhoto ?? undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <Input
        label="Poora Naam"
        placeholder="Jaise: Raj Kumar"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={VALIDATION.NAME_MAX_LENGTH}
        error={errors.name}
      />

      <div>
        <p className="block text-body font-medium text-text-primary mb-2">
          Aap kaun sa kaam karte ho?
        </p>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((skill) => {
            const active = skills.includes(skill.id);
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => toggleSkill(skill.id)}
                aria-pressed={active}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-button border-2 px-3 py-2 text-small transition-all',
                  active
                    ? 'border-primary-dark bg-primary-dark text-white'
                    : 'border-gray-200 bg-gray-50 text-text-secondary hover:border-primary-light'
                )}
              >
                <span>{skill.icon}</span>
                {skill.label}
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
        {errors.skills && <p className="mt-1 text-small text-danger">{errors.skills}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Kitne saal ka experience?"
          type="number"
          inputMode="numeric"
          min={VALIDATION.MIN_EXPERIENCE}
          max={VALIDATION.MAX_EXPERIENCE}
          placeholder="Jaise: 5"
          value={experience}
          onChange={(event) => setExperience(event.target.value)}
          error={errors.experience}
        />
        <Input
          label="Rate per ghanta (Rs.)"
          type="number"
          inputMode="numeric"
          min={VALIDATION.MIN_RATE}
          max={VALIDATION.MAX_RATE}
          placeholder="Jaise: 300"
          value={hourlyRate}
          onChange={(event) => setHourlyRate(event.target.value)}
          error={errors.hourlyRate}
        />
      </div>

      <div>
        <p className="block text-body font-medium text-text-primary mb-2">
          Kahan kahan kaam karoge?
        </p>
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
          {HYDERABAD_AREAS.map((area) => {
            const active = areas.includes(area.id);
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => toggleArea(area.id)}
                aria-pressed={active}
                className={clsx(
                  'rounded-full border px-3 py-1.5 text-caption transition-all',
                  active
                    ? 'border-primary-dark bg-primary-dark text-white'
                    : 'border-gray-200 bg-gray-50 text-text-secondary hover:border-primary-light'
                )}
              >
                {area.label}
              </button>
            );
          })}
        </div>
        {errors.areas && <p className="mt-1 text-small text-danger">{errors.areas}</p>}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-body font-medium text-text-primary mb-2"
        >
          Apne baare me likho (optional)
        </label>
        <textarea
          id="description"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Jaise: Fan, light aur wiring ka 5 saal ka tajurba."
          className="w-full bg-gray-50 border-2 border-transparent rounded-button px-4 py-3 text-body focus:border-primary-dark focus:bg-white transition-all resize-none"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="aadhaar-photo" className="block text-body font-medium text-text-primary mb-2">
            Aadhaar photo (sirf admin dekh sakta hai)
          </label>
          <input
            id="aadhaar-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setAadhaarPhoto(event.target.files?.[0] ?? null)}
            className="block w-full text-small text-text-secondary"
          />
          {aadhaarPhoto && <p className="mt-1 text-caption text-text-secondary">{aadhaarPhoto.name}</p>}
          {errors.aadhaarPhoto && <p className="mt-1 text-small text-danger">{errors.aadhaarPhoto}</p>}
        </div>
        <div>
          <label htmlFor="profile-photo" className="block text-body font-medium text-text-primary mb-2">
            Profile photo (optional)
          </label>
          <input
            id="profile-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setProfilePhoto(event.target.files?.[0] ?? null)}
            className="block w-full text-small text-text-secondary"
          />
          {profilePhoto && <p className="mt-1 text-caption text-text-secondary">{profilePhoto.name}</p>}
          {errors.profilePhoto && <p className="mt-1 text-small text-danger">{errors.profilePhoto}</p>}
        </div>
      </div>

      {serverError && (
        <p className="rounded-button bg-red-50 px-4 py-3 text-small text-danger" role="alert">
          {serverError}
        </p>
      )}

      <Button type="submit" size="lg" fullWidth isLoading={submitting}>
        Profile banao
      </Button>

      <p className="text-caption text-text-secondary text-center">
        Profile admin review ke baad live hogi.
      </p>
    </form>
  );
}
