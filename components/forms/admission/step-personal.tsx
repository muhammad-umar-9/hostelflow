"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { personalInfoSchema, type PersonalInfoValues } from "@/lib/validations";
import { ADMISSION_FORM_ID } from "./types";

export function StepPersonal({
  value,
  onNext,
}: {
  value: PersonalInfoValues;
  onNext: (values: PersonalInfoValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonalInfoValues>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: value,
    mode: "onSubmit",
  });

  return (
    <form
      id={ADMISSION_FORM_ID}
      onSubmit={handleSubmit(onNext)}
      className="flex flex-col gap-3"
      noValidate
    >
      <Field label="Full name" error={errors.name?.message}>
        <Input {...register("name")} placeholder="Zohaib Anwar" />
      </Field>
      <Field label="CNIC / B-Form number" error={errors.cnic?.message}>
        <Input {...register("cnic")} placeholder="35202-1234567-1" className="font-mono" />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Date of birth" error={errors.dob?.message}>
          <Input {...register("dob")} placeholder="12 Mar 2004" />
        </Field>
        <Field label="Joining date" error={errors.joining?.message}>
          <Input {...register("joining")} placeholder="04 Aug 2026" />
        </Field>
      </div>
      <Field label="Mobile / WhatsApp number" error={errors.phone?.message}>
        <Input {...register("phone")} placeholder="0301 2345678" />
      </Field>
      <Field label="Permanent address" error={errors.address?.message}>
        <Input {...register("address")} />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="City" error={errors.city?.message}>
          <Input {...register("city")} />
        </Field>
        <Field label="Student or employee" error={errors.occupation?.message}>
          <select
            {...register("occupation")}
            className="min-h-[46px] w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-p"
          >
            <option value="Student">Student</option>
            <option value="Employee">Employee</option>
          </select>
        </Field>
      </div>
      <Field label="Institution or workplace" error={errors.institution?.message}>
        <Input {...register("institution")} />
      </Field>
    </form>
  );
}
