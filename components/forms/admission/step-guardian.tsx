"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { guardianSchema, type GuardianValues } from "@/lib/validations";
import { ADMISSION_FORM_ID } from "./types";

export function StepGuardian({
  value,
  onNext,
}: {
  value: GuardianValues;
  onNext: (values: GuardianValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GuardianValues>({
    resolver: zodResolver(guardianSchema),
    defaultValues: value,
  });

  return (
    <form
      id={ADMISSION_FORM_ID}
      onSubmit={handleSubmit(onNext)}
      className="flex flex-col gap-3"
      noValidate
    >
      <Field label="Father / guardian name" error={errors.guardianName?.message}>
        <Input {...register("guardianName")} />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Relationship" error={errors.relationship?.message}>
          <Input {...register("relationship")} />
        </Field>
        <Field label="Guardian phone" error={errors.guardianPhone?.message}>
          <Input {...register("guardianPhone")} />
        </Field>
      </div>
      <Field label="Guardian CNIC" error={errors.guardianCnic?.message}>
        <Input {...register("guardianCnic")} className="font-mono" />
      </Field>
      <p className="mt-1 text-xs font-extrabold">Emergency contact</p>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Name" error={errors.emergencyName?.message}>
          <Input {...register("emergencyName")} />
        </Field>
        <Field label="Number" error={errors.emergencyPhone?.message}>
          <Input {...register("emergencyPhone")} />
        </Field>
      </div>
    </form>
  );
}
