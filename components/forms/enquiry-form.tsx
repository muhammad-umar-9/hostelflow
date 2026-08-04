"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useHostel } from "@/components/providers/hostel-provider";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { enquirySchema, type EnquiryValues } from "@/lib/validations";

export function EnquiryForm({ onDone }: { onDone: () => void }) {
  const { addEnquiry, mutating } = useHostel();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EnquiryValues>({
    resolver: zodResolver(enquirySchema),
    defaultValues: {
      name: "",
      phone: "",
      roomType: 4,
      expectedJoining: "10 Aug 2026",
      source: "Walk-in",
      notes: "",
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        await addEnquiry({
          name: values.name,
          phone: values.phone,
          roomType: values.roomType === 3 ? 3 : 4,
          expectedJoining: values.expectedJoining,
          source: values.source,
          notes: values.notes || "",
        });
        onDone();
      })}
    >
      <Field label="Student name" error={errors.name?.message}>
        <Input {...register("name")} placeholder="Talha Mehmood" />
      </Field>
      <Field label="WhatsApp number" error={errors.phone?.message}>
        <Input {...register("phone")} placeholder="0333 4455661" />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Preferred room type" error={errors.roomType?.message}>
          <select
            {...register("roomType")}
            className="min-h-[46px] w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-p"
          >
            <option value={4}>Four-seater · Rs 7,500</option>
            <option value={3}>Three-seater · Rs 9,000</option>
          </select>
        </Field>
        <Field label="Expected joining" error={errors.expectedJoining?.message}>
          <Input {...register("expectedJoining")} />
        </Field>
      </div>
      <Field label="Source" error={errors.source?.message}>
        <select
          {...register("source")}
          className="min-h-[46px] w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-p"
        >
          <option>Walk-in</option>
          <option>WhatsApp</option>
          <option>Facebook</option>
          <option>Referral</option>
          <option>Property Listing</option>
        </select>
      </Field>
      <Field label="Notes" error={errors.notes?.message}>
        <Textarea {...register("notes")} placeholder="Wants ground floor near mess" />
      </Field>
      <Button type="submit" size="lg" disabled={mutating}>
        Save enquiry
      </Button>
    </form>
  );
}
